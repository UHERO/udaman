class FilesyncWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  sidekiq_options queue: :default

  def perform
    Rails.logger.info { 'Performing file sync from NAS' }
    %x{rsync -hav udaman@uheronas:/volume1/blah/blah/ /data}
  end
end
