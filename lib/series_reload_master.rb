class SeriesReloadMaster
  require 'sidekiq'
  require 'sidekiq-status'

  def batch_reload(series_list = nil)
    require 'digest/md5'
    suffix = ''
    if series_list.nil?
      series_list = Series.get_all_uhero
      suffix = '_full'
    end
    datetime = Time.now.strftime('%Y%m%d%H%M') + Time.now.zone
    hash = Digest::MD5.new << "#{datetime}#{series_list.count}#{rand 100000}"
    @batch_id = "#{datetime}_#{series_list.count}_#{hash.to_s[-6..-1]}#{suffix}"

    Rails.logger.info { "SeriesReloadMaster: batch=#{@batch_id}: starting reload" }
    @maxdepth = series_list.maximum(:dependency_depth)
    depth = 3 #@maxdepth
    while depth >= 0
      next_set = series_list.where(dependency_depth: depth)
      Rails.logger.info { ">>>>>>>>>>> SeriesReloadMaster: batch=#{@batch_id}: queueing up depth #{depth} (#{next_set.count} series)" }
      next_set.pluck(:id).each do |series_id|
        log = SeriesSlaveLog.new(batch_id: @batch_id, series_id: series_id, depth: depth)
        unless log.save
          raise 'Cannot save SeriesSlaveLog record to database'
        end
        jid = SeriesSlaveWorker.perform_async @batch_id, series_id
        log.update_attributes job_id: jid
      end
      loop do
        sleep 20.seconds
        Rails.logger.debug { ">>>> SeriesReloadMaster: batch=#{@batch_id} depth=#{depth}: slept 20 more seconds" }
        break if depth_finished(depth)
      end
     break # depth = depth - 1

    end
    Rails.logger.info { "SeriesReloadMaster: batch=#{@batch_id}: done reload" }
  end

private
  def depth_finished(depth)
    outstanding = SeriesSlaveLog.where(batch_id: @batch_id, depth: depth, message: nil)
    return true if outstanding.empty?
    updated = 0
    outstanding.each do |log|
      status = Sidekiq::Status::status(log.job_id)
      next if [:queued, :working].include? status
      log.update_attributes(message: status || 'expired')
      updated += 1
    end
    updated == outstanding.count
  end
end
=begin
    working_jids = Sidekiq::Workers.new.map do |_, _, w|
      batch_id = w['payload']['args'][0]
      batch_id == @batch_id ? w['payload']['jid'] : nil
    end.reject{|x| x.nil? }

    queued_jids = Sidekiq::Queue.new.map do |j|
      batch_id = j.args[0]
      batch_id == @batch_id ? j.jid : nil
    end.reject{|x| x.nil? }
=end
=begin
      next if Time.now < (log.created_at + 15.minutes)
      unless working_jids.include?(log.job_id) || queued_jids.include?(log.job_id)
        unless log.reload.message
          log.update_attributes message: 'disappeared'
        end
        updated += 1
        next
      end
      unless log.reload.message
        log.update_attributes message: 'timedout'
      end
=end
