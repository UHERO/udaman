require 'sidekiq'
require 'redis'

class DvwWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def initialize
    Rails.logger.level = Logger::DEBUG
    @logprefix = self.class
  end

  def perform(dvw_id, do_csv_proc = false)
    mylogger :debug, "ENTER perform async: id=#{dvw_id}"
    upload = nil
    begin
      upload = DvwUpload.find(dvw_id) || raise("No DvwUpload found with id=#{dvw_id}")
      csv_extract(upload) if do_csv_proc
#      mylogger :debug, "before full_load"
#      upload.full_load
#      mylogger :info, "id=#{dvw_id}: loaded and active"
#      upload.update(series_status: :ok, last_error: nil, last_error_at: nil) if upload
    rescue => error
      mylogger :error, error.message
      mylogger :error, error.backtrace
      upload.update(series_status: :fail, last_error: error.message[0..254], last_error_at: Time.now) if upload
    end
  end

private
  def csv_extract(upload)
    xls_path = upload.absolute_path('series')
    csv_path = xls_path.change_file_extension('') ### truncate extension to make a directory name
    other_worker = ENV['OTHER_WORKER']

    unless File.exists?(xls_path)
      Rails.logger.debug { "#{@logprefix}: xls file #{xls_path} does not exist" }
      if other_worker.blank?
        raise "#{@logprefix}: Could not find xlsx file ((#{xls_path}) #{upload.id}) and no $OTHER_WORKER defined"
      end
      unless system("rsync -t #{other_worker + ':' + xls_path} #{upload.absolute_path}")
        raise "#{@logprefix}: Could not get xlsx file ((#{xls_path}) #{upload.id}) from $OTHER_WORKER: #{other_worker}"
      end
    end
    unless system "xlsx2csv.py -a -d tab -c utf-8  #{xls_path} #{csv_path}"
      raise "#{@logprefix}: Could not transform xlsx to csv (#{upload.id})"
    end
    if other_worker && !system("rsync -rt #{csv_path} #{other_worker + ':' + upload.absolute_path}")
      raise "#{@logprefix}: Could not copy #{csv_path} for #{upload.id} to $OTHER_WORKER: #{other_worker}"
    end
  end

  def mylogger(level, message)
    Rails.logger.send(level) { "#{@logprefix}: #{message}" }
  end
end
