# Convert xlsx files to csv format
class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(filename)
    if system "xlsx2csv -s 1 -d tab #{filename} #{filename.split('.')[0]+'.csv'}"
      ## success
    else
      ## fail
    end
  end
end
