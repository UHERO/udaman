require 'sidekiq'
require 'redis'

class SeriesWorker
  include Sidekiq::Worker

  sidekiq_options(retry: 0)  ## do not retry jobs, but log failures

  sidekiq_retries_exhausted do |msg, e|
    Sidekiq.logger.error "Failed #{msg['class']} with #{msg['args']}: #{msg['error_message']}"
    failure = SidekiqFailure.find_or_create_by(series_id: msg['args'][0].to_i)
    failure.update_attributes message: "#{msg['args'][1]}: #{e.class}: #{msg['error_message']}"
  end

  def perform(series_id, batch_id)
    logger.info "SIDEKIQ perform: started on series #{series_id}, batch_id=#{batch_id}"
    finisher = false

    begin
      @batch_id = batch_id
      @redis = Redis.new
      @redis.pipelined do
        redis_decr :queue
        redis_incr :busy_workers
      end
      current_depth = redis_get(:current_depth)
      set_log_prefix(current_depth)

      series = Series.find(series_id)
      errors = []
      if series
        logger.info "#{@log_prefix}: Reload series #{series_id} (#{series.name}) started"
        errors = series.reload_sources(true)
      else
        errors.push "No series with id=#{series_id} found"
      end
      GC.start
      if errors.empty?
        logger.info "#{@log_prefix}: Reload series #{series_id} (#{series.name}) SUCCEEDED"
      else
        logger.info "#{@log_prefix}: Reload series #{series_id} ERRORED: check reload_errors.log"
        File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
      end

      series_list = redis_get(:series_list)
      if series_list.blank?
        raise 'no series list found'
      end
      @all_series = Series.where id: series_list.to_s.scan(/\d+/).map{|s| s.to_i }

      finisher = am_i_the_finisher?
      if finisher
        if survive_waiting_for_others
          next_depth = get_next_nonempty_depth(current_depth)
          if next_depth
            queue_up_next_depth(next_depth)
          end
        end
      end
    rescue => e
      logger.error "#{@log_prefix}: Reload series #{series_id} FAILED: #{e.message}; Backtrace follows"
      logger.error e.backtrace
      if finisher
        redis_set :finishing_depth, false
      end
      @redis.pipelined do
        redis_incr :busy_workers
        redis_incr :queue
      end
      raise

    ensure
      if finisher
        redis_set :finishing_depth, false
      end
      if redis_get(:busy_workers) > 0
        redis_decr :busy_workers
      end
    end
    logger.info "SIDEKIQ perform: finished with series #{series_id}"
    failure = SidekiqFailure.find_by(series_id: series_id)
    failure.destroy if failure
    end

private
  def am_i_the_finisher?
    # check to see if the queue is empty
    if redis_get(:queue) > 0 && Sidekiq::Queue.new.size > 0
      logger.debug "#{@log_prefix}: queue is not empty"
      return false
    end
    logger.debug "#{@log_prefix}: queue is empty"
    # if the queue is empty see if another job has raised the flag
    if redis_getset(:finishing_depth, 'true') == 'true'
      logger.debug "#{@log_prefix}: another worker will finish"
      return false
    end
    logger.debug "#{@log_prefix}: this worker will finish"
    true
  end

  def survive_waiting_for_others
    redis_incr :waiting_workers
    # wait for everyone else to finish
    sleep(1)
    while redis_get(:busy_workers) > 1 && Sidekiq::Workers.new.size > 1
      logger.debug "#{@log_prefix}: waiting for other workers to finish"
      sleep(1)
      # the random component helps avoid a race condition between two processes
      if redis_get(:waiting_workers) > 1 &&
          redis_get(:busy_workers) > 1 &&
          Sidekiq::Workers.new.size > 1 &&
          rand > 0.5
        logger.debug "#{@log_prefix}: breaking ties"
        redis_decr :waiting_workers
        return false
      end
    end
    # if no workers are busy, the queue should be filled with the next depth
    redis_decr :waiting_workers
    true
  end

  def get_next_nonempty_depth(depth)
    loop do
      depth -= 1
      logger.info "#{@log_prefix}: Trying depth #{depth}"
      if depth < 0
        logger.debug "#{@log_prefix}: exhausted all depths, set busy_workers counter to 1"
        redis_set :busy_workers, 1
        return nil
      end
      break unless @all_series.where(dependency_depth: depth).empty?
    end
    set_log_prefix(depth)
    depth
  end

  def queue_up_next_depth(next_depth)
    next_series_set = @all_series.where(dependency_depth: next_depth)
    logger.info "#{@log_prefix}: Queueing up next depth=#{next_depth}, number of series=#{next_series_set.count}"
    @redis.pipelined do
      redis_set :queue, next_series_set.count
      redis_set :current_depth, next_depth
      redis_set :finishing_depth, false
      redis_set :busy_workers, 1
    end
    next_series_set.pluck(:id).each do |id|
      SeriesWorker.perform_async id, @batch_id
    end
    logger.debug "#{@log_prefix}: done queueing up next depth=#{next_depth}"
  end

  def redis_get(key)
    val = @redis.get "#{key}_#{@batch_id}"
    Integer val rescue val
  end

  def redis_set(key, value)
    @redis.set "#{key}_#{@batch_id}", value
  end

  def redis_getset(key, value)
    val = @redis.getset "#{key}_#{@batch_id}", value
    Integer val rescue val
  end

  def redis_incr(key)
    @redis.incr "#{key}_#{@batch_id}"
  end

  def redis_decr(key)
    @redis.decr "#{key}_#{@batch_id}"
  end

  def set_log_prefix(depth)
    @log_prefix = "batch=#{@batch_id},depth=#{depth}"
  end
end
