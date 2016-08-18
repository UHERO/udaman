require 'sidekiq'

class SeriesWorker
  include Sidekiq::Worker
  def perform(series_id)
    Series.find(series_id).reload_sources
  end
end