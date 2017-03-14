# Convert xlsx files to csv format
class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    dbu = DbedtUpload.find(dbu_id)
    file_split = file_path.split('.')
    file_type = file_split[-1]
    path_up_to_last_dot = file_split[0..-2].join('')
    if system "xlsx2csv -s 1 -d tab #{file_path} #{path_up_to_last_dot+'.csv'}"
      dbu.set_status_ok
    else
      dbu.set_status_fail
    end
  end
end
