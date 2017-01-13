class ForecastSnapshot < ActiveRecord::Base
  require 'digest/md5'
  require 'date'
  before_destroy :delete_files_from_disk

  # Get series name from series mnemonic
  def retrieve_name(prefix)
    m = Measurement.find_by(prefix: prefix.chomp('NS'))
    if m.nil?
      return ''
    end
    m.data_portal_name
  end

  # Get series units
  def retrieve_units(prefix)
    m = Measurement.find_by(prefix: prefix.chomp('NS'))
    if m.nil? || m.units_label_short.nil? || m.units_label_short == ''
      return 'Values'
    end
    m.units_label_short
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
    new_tsd_content = newfile.read if newfile
    old_tsd_content = oldfile.read if oldfile
    hist_tsd_content = histfile.read if histfile
## validate file content
    begin
      self.save or raise StandardError, 'FS object save failed'
      if newfile
        write_file_to_disk(new_forecast_tsd_filename, new_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if oldfile
        write_file_to_disk(old_forecast_tsd_filename, old_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if histfile
        write_file_to_disk(history_tsd_filename, hist_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
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

  private
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

  def delete_file_from_disk(name)
    begin
      File.delete(path(name))
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def delete_files_from_disk
      delete_new_forecast_tsd_file &&
      delete_old_forecast_tsd_file &&
      delete_history_tsd_file
  end

  def tsd_rel_filepath(name)
    string = self.created_at.to_s+'_'+self.id.to_s+'_'+name
    hash = Digest::MD5.new << string
    File.join('tsd_files', hash.to_s+'_'+name)
    end
end
