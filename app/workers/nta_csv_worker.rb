require 'sidekiq'
require 'redis'

class NtaCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(nta_id, which)
    logger.debug { "ENTER perform async: id=#{nta_id}, which=#{which}" }
    ntu = NtaUpload.find(nta_id)
    if ntu.nil?
      logger.error { "No NTA Upload with id = #{nta_id}" }
      return
    end
    xls_path = ntu.absolute_path(which)
    csv_path = xls_path.change_file_extension('') ### truncate extension to make a directory name
    other_worker = ENV['OTHER_WORKER']
    begin
      unless File.exists?(xls_path)
        logger.debug { "#{which}: xls file #{xls_path} does not exist" }
        if other_worker.blank?
          raise "Could not find xlsx file ((#{xls_path}) #{nta_id}:#{which}) and no $OTHER_WORKER defined"
        end
        unless system("rsync -t #{other_worker + ':' + xls_path} #{ntu.absolute_path}")
          raise "Could not get xlsx file ((#{xls_path}) #{nta_id}:#{which}) from $OTHER_WORKER: #{other_worker}"
        end
      end
      unless system "xlsx2csv.py -a -d tab -c utf-8  #{xls_path} #{csv_path}"
        raise "Could not transform xlsx to csv (#{nta_id}:#{which})"
      end
      if other_worker && !system("rsync -rt #{csv_path} #{other_worker + ':' + ntu.absolute_path}")
        raise "Could not copy #{csv_path} for #{nta_id} to $OTHER_WORKER: #{other_worker}"
      end
      logger.debug { "NtaUpload #{which}: before load_csv" }
      if ntu.load_csv(which) && ntu.make_active_settings
        logger.info { "NtaUpload id=#{ntu.id} loaded, and active" }
        ntu.set_status(which, :ok)
      end
    rescue => error
      logger.error error.message
      logger.error error.backtrace
      ntu.update(last_error: error.message, last_error_at: Time.now)
      ntu.set_status(which, :fail)
    end
  end
end
