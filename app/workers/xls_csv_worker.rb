# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    logger.debug { "ENTER perform async: id=#{dbu_id}, which=#{which}" }
    puts ">>>>>>>>> ENTER perform async:puts id=#{dbu_id}, which=#{which}"
    dbu = DbedtUpload.find(dbu_id)
    if dbu.nil?
      logger.error('XlsCsvWorker') { "No DBEDT Upload with id = #{dbu_id}" }
      return
    end
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
      logger.debug('>>>>>>>>>') { '%s: before xls2csv' % which }
      puts '>>>>>>>>>puts!! ' + '%s: before xls2csv' % which
      unless system "xlsx2csv.py -s 1 -d tab -c utf-8  #{xls_path} #{csv_path}"
        raise "Could not transform xlsx to csv (#{dbu_id}:#{which})"
      end
      if other_worker && !system("rsync -t #{csv_path} #{other_worker + ':' + dbu.absolute_path}")
        raise "Could not copy #{csv_path} for #{dbu_id} to $OTHER_WORKER: #{other_worker}"
      end
      logger.debug('>>>>>>>>>') { '%s: before load_csv' % which }
      puts '>>>>>>>>>puts!! ' + '%s: before load_csv' % which
      dbu.load_csv(which)
      dbu = DbedtUpload.find(dbu.id) ## reload dbu to get updated other_proc_status -dji
      other_proc_status = (which == 'cats') ? dbu.series_status : dbu.cats_status
      if other_proc_status == 'ok'
        logger.debug('>>>>>>>>>') { '%s: calling make_active_settings' % which  }
        puts '>>>>>>>>>puts!! ' + '%s: calling make_active_settings' % which
        dbu.make_active_settings
        puts '>>>>>>>>>puts!! ' + '%s: DONE make_active_settings' % which
      else
        puts '>>>>>>>>>puts!! ' + "%s: DIDNT CALL! make_active_settings, stati are |cats=#{dbu.cats_status}|series=#{dbu.series_status}|" % which
      end
      dbu.set_status(which, :ok)
    rescue => error
      logger.error error.message
      logger.error error.backtrace
      dbu.update(last_error: error.message, last_error_at: Time.now)
      dbu.set_status(which, :fail)
    end
  end
end
