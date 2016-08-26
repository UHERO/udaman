require 'sidekiq'

class SeriesWorker
  include Sidekiq::Worker
  def perform(series_id)
    errors = Series.find(series_id).reload_sources
    GC.start
    unless errors.nil?
      File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
    end
  end
end