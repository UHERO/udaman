# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    dbu = DbedtUpload.find(dbu_id)
    abspath = (which == 'cats') ? dbu.cats_file_abspath : dbu.series_file_abspath
    #if system "xlsx2csv -s 1 -d tab #{abspath} #{abspath.change_file_ext('csv')}"
    if system "sleep 4; cp #{abspath} #{abspath.change_file_ext('csv')}"
      puts ">>> cp WORKED"
      dbu.set_status(which, :ok)
    else
      puts ">>> cp FAILED"
      dbu.set_status(which, :fail)
    end
  end
end
