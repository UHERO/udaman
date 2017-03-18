# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    dbu = DbedtUpload.find(dbu_id)
    abspath = dbu.file_abspath(which)
    if system "xlsx2csv.py -s 1 -d tab #{abspath} #{abspath.change_file_ext('csv')}"
      dbu.set_status(which, :ok)
    else
      dbu.set_status(which, :fail)
    end
  end
end
