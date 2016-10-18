require 'sidekiq'
require 'redis'

class SeriesWorker
  include Sidekiq::Worker

  def perform(series_id, series_size)
    redis = Redis.new
    redis.decr("queue_#{series_size}")
    redis.incr("busy_workers_#{series_size}")
    errors = Series.find(series_id).reload_sources
    GC.start
    unless errors.nil?
      File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
    end
    # check to see if the queue is empty
    if redis.get("queue_#{series_size}").to_i > 0
      puts "\nWORKER (#{series_size}): queue is not empty\n\n"
      redis.decr("busy_workers_#{series_size}")
      return
    end
    puts "\nWORKER (#{series_size}): queue is empty\n\n"
    # if the queue is empty see if another job has raised the flag
    if redis.getset("finishing_depth_#{series_size}", 'true') == 'true'
      puts "\nWORKER (#{series_size}): Another worker will finish\n\n"
      redis.decr("busy_workers_#{series_size}")
      return
    end
    redis.incr("waiting_workers_#{series_size}")
    puts "\nWORKER (#{series_size}): This worker will finish\n\n"
    # wait for everyone else to finish
    while redis.get("busy_workers_#{series_size}").to_i > 1
      sleep(1)
      # the random component helps avoid a race condition between two processes
      if redis.get("waiting_workers_#{series_size}").to_i > 1 && rand > 0.5
        redis.decr("waiting_workers_#{series_size}")
        redis.decr("busy_workers_#{series_size}")
        return
      end
    end
    # if no workers are busy, the queue should be filled with the next
    redis.set("finishing_depth_#{series_size}", false)
    redis.decr("waiting_workers_#{series_size}")
    next_depth = redis.get("current_depth_#{series_size}").to_i - 1
    if next_depth == -1
      puts "\nWORKER (#{series_size}): on last depth\n\n"
      redis.decr("busy_workers_#{series_size}")
      return
    end
    puts "\nWORKER (#{series_size}): next depth: #{next_depth}\n\n"
    redis.set("current_depth_#{series_size}", next_depth)
    series_ids = redis.get("series_list_#{series_size}").scan(/\d+/).map{|s| s.to_i}
    next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
    while next_series.count == 0
      next_depth -= 1
      puts "\nWORKER (#{series_size}): next depth: #{next_depth}\n\n"
      if next_depth == -1
        redis.decr("busy_workers_#{series_size}")
        return
      end
      redis.set("current_depth_#{series_size}", next_depth)
      next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
    end
    redis.set("queue_#{series_size}", Series.all.where(:dependency_depth => next_depth).count)
    Series.all.where(:id => series_ids, :dependency_depth => next_depth).pluck(:id).each do |id|
      SeriesWorker.perform_async id, series_size
    end
    puts "\nWORKER (#{series_size}): queued up the next depth\n\n"
    redis.decr("busy_workers_#{series_size}")
  end
end