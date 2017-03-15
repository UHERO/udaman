# Convert xlsx files to csv format
class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    dbu = DbedtUpload.find(dbu_id)
    abspath = (which == 'cats') ? dbu.cats_file_abspath : dbu.series_file_abspath
    if system "xlsx2csv -s 1 -d tab #{abspath} #{abspath.change_file_ext('csv')}"
      dbu.set_status_ok
    else
      dbu.set_status_fail
    end
  end
end


