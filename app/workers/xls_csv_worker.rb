# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    dbu = DbedtUpload.find(dbu_id)
    abspath = dbu.file_abspath(which)
    csv_path = abspath.change_file_ext('csv')
    if system "xlsx2csv.py -s 1 -d tab #{abspath} #{csv_path}"
      dbu.set_status(which, :ok)
      if system "rsync -t #{csv_path} deploy@uhero-worker.colo.hawaii.edu:/data/dbedt_files"
        #do something
      else
        #do somethingelse
      end
    else
      dbu.set_status(which, :fail)
    end
  end
end
