require 'sidekiq'

class SeriesWorker
  include Sidekiq::Worker
  def perform(series_id)
    errors = Series.find(series_id).reload_sources
    unless errors.nil?
      puts errors
    end
  end
end