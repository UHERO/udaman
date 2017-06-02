# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    begin
      dbu = DbedtUpload.find(dbu_id)
      if dbu.nil?
        logger.error "No DBEDT Upload with id = #{dbu_id}"
        return
      end
      xls_path = dbu.absolute_path(which)
      csv_path = xls_path.change_file_extension('csv')
      if !File.exists?(xls_path) && !system("rsync -t #{ENV['OTHER_WORKER'] + ':' + xls_path} #{dbu.absolute_path}")
        logger.error "Could not get xlsx file ((#{xls_path}) #{dbu_id}:#{which}) from $OTHER_WORKER: #{ENV['OTHER_WORKER']}"
        dbu.set_status(which, :fail)
        return
      end
      unless system "xlsx2csv.py -s 1 -d tab -c utf-8  #{xls_path} #{csv_path}"
        logger.error "Could not transform xlsx to csv (#{dbu_id}:#{which})"
        dbu.set_status(which, :fail)
        return
      end
      if !ENV['OTHER_WORKER'].nil? && !system("rsync -t #{csv_path} #{ENV['OTHER_WORKER'] + ':' + dbu.absolute_path}")
        logger.error "Could not copy #{csv_path} for #{dbu_id} to $OTHER_WORKER: #{ENV['OTHER_WORKER']}"
        dbu.set_status(which, :fail)
        return
      end
      dbu.load_csv(which)
      dbu.set_status(which, :ok)
      if dbu.cats_status == :ok && dbu.series_status == :ok
        dbu.update_attributes(active: true, last_error: nil, last_error_at: nil)
      end
    rescue => error
      logger.error error.message
      logger.error error.backtrace
      dbu.update_attributes(last_error: error.message, last_error_at: Time.now)
      dbu.set_status(which, :fail)
    end
  end
end
