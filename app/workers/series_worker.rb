require 'sidekiq'
require 'redis'

class SeriesWorker
  include Sidekiq::Worker
  def perform(series_id, series_size)
    errors = Series.find(series_id).reload_sources
    GC.start
    unless errors.nil?
      File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
    end
    # check to see if the queue is empty
    if Sidekiq::Queue.new.size > 0
      puts 'WORKER: queue is not empty'
      return
    end
    puts 'WORKER: queue is empty'
    # if the queue is empty see if another job has raised the flag
    redis = Redis.new
    if redis.get('finishing_depth') == 'true'
      puts 'WORKER: Another worker will finish'
      return
    end
    puts 'WORKER: This worker will finish'
    # no one else has so time to raise the flag
    redis.set('finishing_depth', true)
    # wait for everyone else to finish
    sleep(1) until Sidekiq::Workers.new.size <= 1
    # if no workers are busy, the queue should be filled with the next
    next_depth = redis.get('current_depth').to_i - 1
    if next_depth == 0
      puts 'WORKER: on last depth'
      return
    end
    puts "WORKER: Next depth: #{next_depth}"
    redis.set('current_depth', next_depth)
    series_ids = redis.get("series_list_#{series_size}").scan(/\d+/).map{|s| s.to_i}
    Series.all.where(:id => series_ids, :dependency_depth => next_depth).pluck(:id).each do |id|
      SeriesWorker.perform_async id, series_size
    end
    puts 'WORKER: queued up the next depth'
    redis.set('finishing_depth', false)
  end
end