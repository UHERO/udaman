class SeriesReloadMaster
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

    Rails.logger.info { "Starting Reload by Deps Master/Slave: batch=#{@batch_id}" }
    depth = series_list.order(:dependency_depth => :desc).first.dependency_depth
    while depth >= 0
      Rails.logger.info { "Starting depth #{depth}: batch=#{@batch_id}" }
      series_list.where(dependency_depth: depth).pluck(:id).each do |series_id|
        SeriesSlaveWorker.perform_async @batch_id, series_id
        SeriesSlaveLog.create(batch_id: @batch_id, series_id: series_id, depth: depth, update_at: Time.now)
      end
      do
      sleep 30.seconds
      Rails.logger.debug { 'slept 30 more seconds' }
    end until depth_done(depth)
    depth = depth - 1
  end
  end

private
  def depth_done(depth)
    outstanding = SeriesSlaveLog.find_by(batch_id: @batch_id, depth: depth, message: nil)
    outstanding.empty?
  end
end
