class ReloadTracker < ActiveRecord::Base
  belongs_to :series

  def ReloadTracker.start(series_id)
    begin
      new = ReloadTracker.create(series_id: series_id, start_time: Time.now)
    rescue => e
      logger.error "ReloadTracker start: #{e.message}"
      raise
    end
    new
  end

  def finish
    begin
      self.end_time = Time.now
      self.save
    rescue => e
      logger.error "ReloadTracker finish: #{e.message}"
      raise
    end
  end

end
