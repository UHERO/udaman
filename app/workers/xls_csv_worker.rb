# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    Rails.logger.info { "ENTER XlsCsvWorker.perform async: id=#{dbu_id}, which=#{which}" }
    dbu = DbedtUpload.find(dbu_id)
    if dbu.nil?
      Rails.logger.error { "No DBEDT Upload with id = #{dbu_id}" }
      return
    end
    xls_path = dbu.absolute_path(which)
    csv_path = xls_path.change_file_extension('csv')
    other_worker = ENV['OTHER_WORKER']
    begin
      unless File.exists?(xls_path)
        Rails.logger.debug { "#{which}: xls file #{xls_path} does not exist" }
        if other_worker.blank?
          raise "Could not find xlsx file ((#{xls_path}) #{dbu_id}:#{which}) and no $OTHER_WORKER defined"
        end
        unless system("rsync -t #{other_worker + ':' + xls_path} #{dbu.absolute_path}")
          raise "Could not get xlsx file ((#{xls_path}) #{dbu_id}:#{which}:#{$?}) from $OTHER_WORKER: #{other_worker}"
        end
      end
      unless system "xlsx2csv.py -s 1 -d tab -c utf-8  #{xls_path} #{csv_path}"
        raise "Could not transform xlsx to csv (#{dbu_id}:#{which}:#{$?})"
      end
      if other_worker && !system("rsync -t #{csv_path} #{other_worker + ':' + dbu.absolute_path}")
        raise "Could not copy #{csv_path} for #{dbu_id} to $OTHER_WORKER: #{other_worker} (#{$?})"
      end
      Rails.logger.debug { "#{which}: before load_csv" }
      dbu.load_csv(which)
      dbu.reload ## to get updated other_proc_status
      other_proc_status = (which == 'cats') ? dbu.series_status : dbu.cats_status
      if other_proc_status == 'ok'
        Rails.logger.debug { "#{which}: calling make_active_settings" }
        dbu.make_active_settings
        Rails.logger.info { "DbedtUpload id=#{dbu.id} loaded, and active" }
      end
      dbu.set_status(which, :ok)
    rescue => error
      Rails.logger.error error.message
      Rails.logger.error error.backtrace
      dbu.update(last_error: error.message[0..254], last_error_at: Time.now)
      dbu.set_status(which, :fail)
    end
    Rails.logger.info { "DONE XlsCsvWorker.perform async: id=#{dbu_id}, which=#{which}" }
  end
end
