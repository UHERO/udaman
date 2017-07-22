require 'sidekiq'
require 'redis'

class NtaCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def initialize
    logger.level = Logger::DEBUG
    #logger.level = Logger::INFO ## DEBUG
  end

  def perform(nta_id)
    logger.debug { "ENTER perform async: id=#{nta_id}" }
    other_worker = ENV['OTHER_WORKER']
    upload = nil
    begin
      upload = NtaUpload.find(nta_id) || raise("No NtaUpload found with id=#{nta_id}")
      xls_path = upload.absolute_path('series')
      csv_path = xls_path.change_file_extension('') ### truncate extension to make a directory name

      unless File.exists?(xls_path)
        logger.debug { "NtaCsvWorker: xls file #{xls_path} does not exist" }
        if other_worker.blank?
          raise "Could not find xlsx file ((#{xls_path}) #{nta_id}) and no $OTHER_WORKER defined"
        end
        unless system("rsync -t #{other_worker + ':' + xls_path} #{upload.absolute_path}")
          raise "Could not get xlsx file ((#{xls_path}) #{nta_id}) from $OTHER_WORKER: #{other_worker}"
        end
      end
      unless system "xlsx2csv.py -a -d tab -c utf-8  #{xls_path} #{csv_path}"
        raise "Could not transform xlsx to csv (#{nta_id})"
      end
      if other_worker && !system("rsync -rt #{csv_path} #{other_worker + ':' + upload.absolute_path}")
        raise "Could not copy #{csv_path} for #{nta_id} to $OTHER_WORKER: #{other_worker}"
      end
      logger.debug { 'NtaCsvWorker: before full_load' }
      upload.full_load
      logger.info { "NtaCsvWorker id=#{nta_id}: loaded and active" }
      upload.set_status('series', :ok)
    rescue => error
      logger.error "NtaCsvWorker: #{error.message}"
      logger.error error.backtrace
      upload.update(last_error: error.message, last_error_at: Time.now)
      upload.set_status('series', :fail)
    end
  end
end
