require 'sidekiq'
require 'redis'

class SeriesWorker
  include Sidekiq::Worker

  def perform(series_id, series_size)
    keys = {
      queue: "queue_#{series_size}",
      busy_workers: "busy_workers_#{series_size}",
      finishing_depth: "finishing_depth_#{series_size}",
      waiting_workers: "waiting_workers_#{series_size}",
      current_depth: "current_depth_#{series_size}",
      series_list: "series_list_#{series_size}"
    }
    finisher = false

    begin
      redis = Redis.new
      redis.pipelined do
        redis.decr keys[:queue]
        redis.incr keys[:busy_workers]
      end

      errors = Series.find(series_id).reload_sources
      GC.start
      unless errors.nil?
        File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
      end
      # check to see if the queue is empty
      if redis.get(keys[:queue]).to_i > 0 && Sidekiq::Queue.new.size > 0
        puts "\nWORKER (#{series_size}): queue is not empty\n\n"
        return
      end
      puts "\nWORKER (#{series_size}): queue is empty\n\n"
      # if the queue is empty see if another job has raised the flag
      if redis.getset(keys[:finishing_depth], 'true') == 'true'
        puts "\nWORKER (#{series_size}): Another worker will finish\n\n"
        return
      end
      finisher = true

      redis.incr keys[:waiting_workers]
      puts "\nWORKER (#{series_size}): This worker will finish\n\n"
      # wait for everyone else to finish
      sleep(1)
      while redis.get(keys[:busy_workers]).to_i > 1 && Sidekiq::Workers.new.size > 1
        puts "\nWORKER (#{series_size}): waiting for other workers to finish\n\n"
        sleep(1)
        # the random component helps avoid a race condition between two processes
        if redis.get(keys[:waiting_workers]).to_i > 1 &&
            redis.get(keys[:busy_workers]).to_i > 1 &&
            Sidekiq::Workers.new.size > 1 &&
            rand > 0.5
          puts "\nWORKER (#{series_size}): breaking ties\n\n"
          redis.decr keys[:waiting_workers]
          return
        end
      end
      # if no workers are busy, the queue should be filled with the next depth
      redis.decr keys[:waiting_workers]

      next_depth = redis.get(keys[:current_depth]).to_i - 1
      if next_depth == -1
        puts "\nWORKER (#{series_size}): on last depth\n\n"
        redis.set keys[:busy_workers], 1
        return
      end
      puts "\nWORKER (#{series_size}): next depth: #{next_depth}\n\n"
      series_ids = redis.get(keys[:series_list]).scan(/\d+/).map{|s| s.to_i}
      next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
      while next_series.count == 0
        next_depth -= 1
        puts "\nWORKER (#{series_size}): next depth: #{next_depth}\n\n"
        if next_depth == -1
          puts "\nWORKER (#{series_size}): set busy_workers counter to 1 (next_series.count == 0)\n\n"
          redis.set keys[:busy_workers], 1
          return
        end
        next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
      end

      redis.pipelined do
        redis.set keys[:queue], next_series.count
        redis.set keys[:current_depth], next_depth
        redis.set keys[:finishing_depth], false
        redis.set keys[:busy_workers], 1
      end
      puts "\nWORKER (#{series_size}): set busy_workers counter to 1 (end of worker)\n\n"
      next_series.pluck(:id).each do |id|
        SeriesWorker.perform_async id, series_size
      end
      puts "\nWORKER (#{series_size}): queued up the next depth\n\n"

    rescue => e
      puts "\nWORKER (#{series_size}): error running series #{series_id}\n\n"
      puts e.backtrace
      if finisher
        redis.set keys[:finishing_depth], false
      end
      redis.pipelined do
        redis.incr keys[:busy_workers]
        redis.incr keys[:queue]
      end
      raise

    ensure
      if finisher
        redis.set keys[:finishing_depth], false
      end
      # busy workers had been going negative
      if redis.get(keys[:busy_workers]).to_i > 0
        redis.decr keys[:busy_workers]
      end
    end
  end
end