class SeriesReloadMaster
  require 'sidekiq'

  def reload(series_list = nil)
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
    depth = series_list.maximum(:dependency_depth)
    while depth >= 0
      next_set = series_list.where(dependency_depth: depth)
      Rails.logger.info { ">>>>>>>>>>> SeriesReloadMaster: batch=#{@batch_id}: queueing up depth #{depth} (#{next_set.count} series)" }
      next_set.pluck(:id).each do |series_id|
        log = SeriesSlaveLog.new(batch_id: @batch_id, series_id: series_id, depth: depth)
        unless log.save
          raise 'Cannot save SeriesSlaveLog record to database'
        end
        jid = SeriesSlaveWorker.perform_async @batch_id, series_id
        raise 'Did not get a job id' unless jid
        log.update_attributes job_id: jid
      end
      loop do
        sleep 20.seconds
        Rails.logger.debug { ">>>> SeriesReloadMaster: batch=#{@batch_id} depth=#{depth}: slept 30 more seconds" }
        break if depth_finished(depth)
      end
      depth = depth - 1
    end
    Rails.logger.info { "SeriesReloadMaster: batch=#{@batch_id}: done reload" }
  end

private
  def depth_finished(depth)
    t = Time.now
    live_jids = Sidekiq::Workers.new.map do |_, _, w|
      batch_id = w['payload']['args'][0]
      batch_id == @batch_id ? w['payload']['jid'] : nil
    end.reject{|x| x.nil? }

    outstanding = SeriesSlaveLog.where(batch_id: @batch_id, depth: depth, message: nil)
    return true if outstanding.empty?
    missing = outstanding.select{|log| !live_jids.include?(log.job_id) }
    missing.each {|log| log.update_attributes message: 'abandoned' }
    (outstanding - missing).each do |log|
      log
    end
    missing.count == outstanding.count
  end
end
