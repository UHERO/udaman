# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    dbu = DbedtUpload.find(dbu_id)
    xls_path = dbu.file_abspath(which)
    csv_path = xls_path.change_file_ext('csv')
    if system "xlsx2csv.py -s 1 -d tab #{xls_path} #{csv_path}"
      puts '>>>>> DEBUG: xlsx2csv succeeded'
      if system "rsync -t #{csv_path} deploy@uhero-worker.colo.hawaii.edu:/data/dbedt_files"
        dbu.set_status(which, :ok)
        return
      end
      dbu.set_status(which, :fail)
    end
  end
end
