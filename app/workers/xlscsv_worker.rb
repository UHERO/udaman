# Convert xlsx files to csv format
class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(file_path)
    path_up_to_last_dot = file_path.split('.')[0..-2].join('')
    if system "xlsx2csv -s 1 -d tab #{file_path} #{path_up_to_last_dot+'.csv'}"
      ## success
    else
      ## fail
    end
  end
end
