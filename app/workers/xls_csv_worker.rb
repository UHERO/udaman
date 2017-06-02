# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    Rails.logger.debug ">>>>>>> ENTER perform async: id=#{dbu_id}, which=#{which}"
    dbu = DbedtUpload.find(dbu_id)
    if dbu.nil?
      logger.error "No DBEDT Upload with id = #{dbu_id}"
      return
    end
    Rails.logger.debug '>>>>>>> DBU is ok'
    xls_path = dbu.absolute_path(which)
    csv_path = xls_path.change_file_extension('csv')
    other_worker = ENV['OTHER_WORKER']
    begin
      unless File.exists?(xls_path)
        if other_worker.blank?
          raise "Could not find xlsx file ((#{xls_path}) #{dbu_id}:#{which}) and no $OTHER_WORKER defined"
        end
        unless system("rsync -t #{other_worker + ':' + xls_path} #{dbu.absolute_path}")
          raise "Could not get xlsx file ((#{xls_path}) #{dbu_id}:#{which}) from $OTHER_WORKER: #{other_worker}"
        end
      end
      Rails.logger.debug '>>>>>>> Before xls2csv'
      unless system "xlsx2csv.py -s 1 -d tab -c utf-8  #{xls_path} #{csv_path}"
        raise "Could not transform xlsx to csv (#{dbu_id}:#{which})"
      end
      if other_worker && !system("rsync -t #{csv_path} #{other_worker + ':' + dbu.absolute_path}")
        raise "Could not copy #{csv_path} for #{dbu_id} to $OTHER_WORKER: #{other_worker}"
      end
      Rails.logger.debug '>>>>>>> Before load_csv'
      dbu.load_csv(which)
      dbu.set_status(which, :ok)
      if dbu.cats_status == :ok && dbu.series_status == :ok
        dbu.update(active: true, last_error: nil, last_error_at: nil)
      end
    rescue => error
      logger.error error.message
      logger.error error.backtrace
      dbu.update(last_error: error.message, last_error_at: Time.now)
      dbu.set_status(which, :fail)
    end
  end
end
