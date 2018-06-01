class SeriesReloadMaster
  def SeriesReloadMaster.reload(series_list = nil)
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
        SeriesSlaveWorker.perform_async @batch_id, series_id
        SeriesSlaveLog.create(batch_id: @batch_id, series_id: series_id, depth: depth)
      end
      loop do
        sleep 30.seconds
        Rails.logger.debug { ">>>> SeriesReloadMaster: batch=#{@batch_id} depth=#{depth}: slept 30 more seconds" }
        break if depth_finished(depth)
      end
      depth = depth - 1
    end
    Rails.logger.info { "SeriesReloadMaster: batch=#{@batch_id}: done reload" }
  end

private
  def self.depth_finished(depth)
    t = Time.now
    outstanding = SeriesSlaveLog.where(batch_id: @batch_id, depth: depth, message: nil)
    return true if outstanding.empty?
    oldies = outstanding.select {|sl| sl.created_at < (t - 5.minutes) }
    oldies.each {|sl| sl.update_attributes message: 'abandoned' }
    oldies.count == outstanding.count
  end
end
