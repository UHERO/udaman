class ForecastSnapshot < ApplicationRecord
  include Cleaning
  require 'digest/md5'
  require 'date'
  before_destroy :delete_files_from_disk

  validates :name, presence: true
  validates :version, presence: true

  # Get series name from series mnemonic
  def retrieve_name(name)
    s = Series.find_by(universe: 'UHERO', name: name)
    if s.nil?
      prefix = name[/[^@]*/]
      like_series = Series.find_by("universe = 'UHERO' and name LIKE '#{prefix}@%'")
      return like_series ? like_series.dataPortalName : 'NO_NAME_FOUND'
    end
    s.aremos_series.description.titlecase
  end

  # Get series percent from series mnemonic
  def retrieve_percent(name)
    s = Series.find_by(universe: 'UHERO', name: name)
    if s.nil?
      return ''
    end
    s.percent
  end

  # Get series units
  def retrieve_units(prefix)
    m = Measurement.find_by(universe: 'UHERO', prefix: prefix.chomp('NS'))
    return 'Values' if m.nil?
    m.unit ? m.unit.short_label : 'Values'
  end

  # Get series ID for each series
  def retrieve_series_id(name)
    s = Series.find_by(universe: 'UHERO', name: name)
    if s.nil?
      return ''
    end
    s.id
  end

  # Check if series is restricted, if yes, set restricted to false (allows series to be visible in Data Portal)
  def unrestrict_series(name)
    s = Series.find_by(universe: 'UHERO', name: name)
    if !s.nil? && s.restricted
      s.update_attributes({:restricted => false})
    end
  end

  def path(filename)
    File.join(ENV['DATA_PATH'], tsd_rel_filepath(filename))
  end

  def new_forecast_tsd
    TsdFile.new(:forecast_snapshot_id => id, :filename => new_forecast_tsd_filename)
  end

  def old_forecast_tsd
    TsdFile.new(:forecast_snapshot_id => id, :filename => old_forecast_tsd_filename)
  end

  def history_tsd
    TsdFile.new(:forecast_snapshot_id => id, :filename => history_tsd_filename)
  end

  def store_fs(newfile = nil, oldfile = nil, histfile = nil)
    new_tsd_content = newfile && newfile.read
    old_tsd_content = oldfile && oldfile.read
    hist_tsd_content = histfile && histfile.read
    begin
      self.save! || raise('ForecastSnapshot object save failed')
      if new_tsd_content
        write_file_to_disk(new_forecast_tsd_filename, new_tsd_content) || raise('TSD newfile disk write failed')
      end
      if old_tsd_content
        write_file_to_disk(old_forecast_tsd_filename, old_tsd_content) || raise('TSD oldfile disk write failed')
      end
      if hist_tsd_content
        write_file_to_disk(history_tsd_filename, hist_tsd_content) || raise('TSD histfile disk write failed')
      end
    rescue StandardError => e
      Rails.logger.error { "store_fs: #{e.message}" }
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def make_copy
    raise 'Please do not duplicate a snapshot that already has Copy in the name. Rename first?' if name =~ /Copy/i
    copy = self.dup
    copy.assign_attributes(name: name + ' Copy', version: increment_version, published: false)
    copy.save!
    begin  ### copy the files
      new_tsd = read_file_from_disk(new_forecast_tsd_filename) || raise('read new_forecast')
      old_tsd = read_file_from_disk(old_forecast_tsd_filename) || raise('read old_forecast')
      hist_tsd = read_file_from_disk(history_tsd_filename)     || raise('read history')
      copy.write_file_to_disk(new_forecast_tsd_filename, new_tsd) || raise('write new_forecast')
      copy.write_file_to_disk(old_forecast_tsd_filename, old_tsd) || raise('write old_forecast')
      copy.write_file_to_disk(history_tsd_filename,     hist_tsd) || raise('write history')
    rescue => e
      (op, file) = e.message.split
      msg = "Duplicate fail: Could not #{op} the #{file} file"
      Rails.logger.error { msg }
      if op == 'write'
        copy.delete_file_from_disk(new_forecast_tsd_filename) if file == 'history' || file == 'old_forecast'
        copy.delete_file_from_disk(old_forecast_tsd_filename) if file == 'history'
      end
      raise msg
    end
    copy
  end

  def delete_new_forecast_tsd_file
    new_forecast_tsd_filename ? delete_file_from_disk(new_forecast_tsd_filename) : true
  end

  def delete_old_forecast_tsd_file
    old_forecast_tsd_filename ? delete_file_from_disk(old_forecast_tsd_filename) : true
  end

  def delete_history_tsd_file
    history_tsd_filename ? delete_file_from_disk(history_tsd_filename) : true
  end

  def tsd_rel_filepath(name)
    if name =~ /[\\]*\.[\\]*\./  ## paths that try to access Unix '..' convention for parent directory
      Rails.logger.warn { 'WARNING! Attempt to access filesystem path %s' % name }
      return
    end
    string = '%s_%d_%s' % [created_at.utc, id, name]
    hash = Digest::MD5.new << string
    File.join('tsd_files', hash.to_s + '_' + name)
  end

  def write_file_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_file_from_disk(name)
    begin
      File.delete(path(name))
    rescue => e
      Rails.logger.error e.message
      unless e.message =~ /no such file/i
        throw(:abort)
      end
    end
    true
  end

  def filename_title(type)
    tsd_rel_filepath(send(type)).split('/').pop rescue nil
  end

  private

  def increment_version
    vers_base = version.sub(/\.\d*$/, '')
    verses = ForecastSnapshot.where('name = ? and version regexp ?', name, "^#{vers_base}\\.").pluck(:version)
    max = 0
    verses.each do |vs|
      if vs =~ /\.(\d+)$/
        if $1.to_i > max
          max = $1.to_i
        end
      end
    end
    '%s.%d' % [vers_base, max + 1]
  end

  def delete_files_from_disk
      delete_new_forecast_tsd_file &&
      delete_old_forecast_tsd_file &&
      delete_history_tsd_file
  end

end
