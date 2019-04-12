class DvwUpload < ApplicationRecord
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(series_file)
    now = Time.now.localtime
    return false unless series_file
    series_file_content = series_file.read
    series_file_ext = series_file.original_filename.split('.')[-1]
    self.series_filename = NtaUpload.make_filename(now, 'series', series_file_ext)
    self.set_status('series', :processing)

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'DVW upload object save failed'
      write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'DVW upload disk write failed'
      NtaCsvWorker.perform_async(id)
    rescue => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! :active => status
  end

  def make_active
    DvwUpload.update_all active: false
    DvwLoadWorker.perform_async(self.id)
    self.update series_status: 'processing'
  end

  def make_active_settings
    DvwUpload.update_all active: false
    self.update! active: true, last_error: nil, last_error_at: nil
  end

  def get_status(which)
    if which == 'cats'
      cats_status
    else
      series_status
    end
  end

  def set_status(which, status)
    if which == 'cats'
      self.update_attributes(:cats_status => status)
    else
      self.update_attributes(:series_status => status)
    end
  end

  def absolute_path(which = nil)
    if which == 'cats'
      path(cats_filename)
    elsif which == 'series'
      path(series_filename)
    else
      path
    end
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_series_file
    xlspath = absolute_path('series')
    if series_filename && File.exists?(xlspath)
      r = delete_file_from_disk xlspath
      r &&= FileUtils.rm_rf xlspath.change_file_extension('')  ## the dir containing csv files -dji
      return (r || throw(:abort))
    end
    true
  end

  def full_load
    Rails.logger.debug { "DvwLoadWorker id=#{self.id} BEGIN full load #{Time.now}" }
    load_cats_csv
    Rails.logger.debug { "DvwLoadWorker id=#{self.id} DONE load cats #{Time.now}" }
    load_series_csv
    Rails.logger.debug { "DvwLoadWorker id=#{self.id} DONE load series #{Time.now}" }
    load_data_postproc
    Rails.logger.debug { "DvwLoadWorker id=#{self.id} DONE load postproc #{Time.now}" }
    make_active_settings
    Rails.logger.info { "DvwLoadWorker id=#{self.id} loaded as active #{Time.now}" }
  end

  def load_cats_csv
    Rails.logger.debug { 'starting load_cats_csv' }
    unless series_filename
      raise 'load_cats_csv: no series_filename'
    end
    true
  end

  def load_series_csv
    Rails.logger.debug { 'starting load_series_csv' }
    unless series_filename
      raise 'load_series_csv: no series_filename'
    end
    csv_path = path(series_filename).change_file_extension('')
  end

  def DvwUpload.load(id)
    du = NtaUpload.find(id) || raise("No DvwUpload found with id=#{id}")
    du.full_load
  end

  def DvwUpload.average(id, group)
    # this method is a noop/placeholder
    "#{id} #{group}"
  end

  def DvwUpload.delete_universe_dvw
    #ActiveRecord::Base.connection.execute <<~SQL
    #  delete from public_data_points where universe = 'NTA' ;
    #SQL
  end

  def load_data_postproc
    Rails.logger.debug { "DEBUG: DvwLoadWorker starting load_data_postproc at #{Time.now}" }
  end

private
  def path(name = nil)
    parts = [ENV['DATA_PATH'], 'dvw_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def DvwUpload.make_filename(time, type, ext)
    ## a VERY rough heuristic for whether we have a correct file extention
    ext = ext.length > 4 ? '' : '.' + ext
    time.strftime('%Y-%m-%d-%H:%M:%S') + '_' + type + ext
  end

  def write_file_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_file_from_disk(abspath)
    begin
      File.delete(abspath)
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def delete_files_from_disk
    delete_series_file
  end

  def delete_data_and_data_sources
    DvwUpload.connection.execute <<~SQL
      DELETE FROM data_points
      WHERE data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'DvwUpload.load(#{self.id},%)');
    SQL
    DataSource.where("eval LIKE 'DvwUpload.load(#{self.id},%)'").delete_all
  end

end
