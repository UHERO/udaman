class SeriesReloadManager
  require 'sidekiq'
  require 'sidekiq-status'

  def initialize(series_list = nil)
    suffix = nil
    if series_list.nil?
      series_list = Series.get_all_uhero
      suffix = '_full'
    end
    @batch = create_batch_id(series_list.count, suffix)
    @series_list = series_list
  end

  def batch_reload(cycle_time = 15)
    mylogger :info, 'starting batch reload'
    depth = @series_list.maximum(:dependency_depth)
    while depth >= 0
      depth_set = @series_list.where(dependency_depth: depth)
      mylogger :info, "queueing up depth #{depth} (#{depth_set.count} series)"
      depth_set.pluck(:id).in_groups_of(25, false) do |group|
        mylogger :debug, "processing at depth #{depth} => #{group}"
        group.each do |series_id|
          log = SeriesReloadLog.new(batch_id: @batch, series_id: series_id, depth: depth)
          unless log.save
            raise "Cannot save worker log record to database: batch=#{@batch} series_id=#{series_id}"
          end
          jid = SeriesReloadWorker.perform_async @batch, series_id, depth
          log.update_attributes job_id: jid
        end
        loop do
          sleep cycle_time.seconds
          mylogger :debug, "depth=#{depth}: slept #{cycle_time} more seconds"
          break if group_finished(depth)
        end
      end
      depth = depth - 1
    end
    mylogger :info, 'done batch reload'
  end

  def batch_id
    @batch
  end

  private
  def create_batch_id(list_length, suffix = nil)
    require 'digest/md5'
    datetime = Time.now.strftime('%Y%m%d%H%M') + Time.now.zone
    hash = Digest::MD5.new << "#{datetime}#{list_length}#{rand 100000}"
    "#{datetime}_#{list_length}_#{hash.to_s[-6..-1]}#{suffix}"
  end

  def group_finished(depth)
    outstanding = SeriesReloadLog.where(batch_id: @batch, depth: depth, status: nil)
    return true if outstanding.empty?
    updated = 0
    outstanding.each do |log|
      status = Sidekiq::Status::status(log.job_id)
      next if status == :working || status == :queued
      log.update_attributes(status: status || 'expired')
      updated += 1
    end
    updated == outstanding.count
  end

  def mylogger(level, message)
    Rails.logger.send(level) { "#{self.class} batch=#{@batch}: #{message}" }
  end
end
