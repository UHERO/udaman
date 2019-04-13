require 'sidekiq'
require 'redis'

class DvwWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def initialize
    Rails.logger.level = Logger::INFO ## DEBUG
  end

  def perform(nta_id, do_csv_proc = false)
    Rails.logger.debug { "ENTER perform async: id=#{nta_id}" }
    upload = nil
    begin
      upload = NtaUpload.find(nta_id) || raise("No NtaUpload found with id=#{nta_id}")
      csv_proc(upload) if do_csv_proc
      Rails.logger.debug { 'NtaCsvWorker: before full_load' }
      upload.full_load
      Rails.logger.info { "NtaCsvWorker id=#{nta_id}: loaded and active" }
      upload.set_status('series', :ok)
    rescue => error
      Rails.logger.error "NtaCsvWorker: #{error.message}"
      Rails.logger.error error.backtrace
      upload.update(last_error: error.message[0..254], last_error_at: Time.now)
      upload.set_status('series', :fail)
    end
  end

private
  def csv_proc(upload)
    xls_path = upload.absolute_path('series')
    csv_path = xls_path.change_file_extension('') ### truncate extension to make a directory name
    other_worker = ENV['OTHER_WORKER']

    unless File.exists?(xls_path)
      Rails.logger.debug { "NtaCsvWorker: xls file #{xls_path} does not exist" }
      if other_worker.blank?
        raise "Could not find xlsx file ((#{xls_path}) #{upload.id}) and no $OTHER_WORKER defined"
      end
      unless system("rsync -t #{other_worker + ':' + xls_path} #{upload.absolute_path}")
        raise "Could not get xlsx file ((#{xls_path}) #{upload.id}) from $OTHER_WORKER: #{other_worker}"
      end
    end
    unless system "xlsx2csv.py -a -d tab -c utf-8  #{xls_path} #{csv_path}"
      raise "Could not transform xlsx to csv (#{upload.id})"
    end
    if other_worker && !system("rsync -rt #{csv_path} #{other_worker + ':' + upload.absolute_path}")
      raise "Could not copy #{csv_path} for #{upload.id} to $OTHER_WORKER: #{other_worker}"
    end
  end
end
