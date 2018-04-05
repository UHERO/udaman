class ReloadTracker < ActiveRecord::Base
  belongs_to :series

  def start(series_id)
    begin
      ReloadTracker.create(series_id: series_id, start_time: Time.now)
    rescue => e
      logger.error "ReloadTracker start: #{e.message}"
    end
  end

  def finish
    begin
      self.end_time = Time.now
      self.save
    rescue => e
      logger.error "ReloadTracker finish: #{e.message}"
    end
  end

end
