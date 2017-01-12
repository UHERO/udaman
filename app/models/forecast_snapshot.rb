class ForecastSnapshot < ActiveRecord::Base
  require 'digest/md5'
  require 'date'
  before_destroy :delete_files_from_disk

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
        write_file_to_disk(self.new_forecast_tsd_filename, new_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if oldfile
        write_file_to_disk(self.old_forecast_tsd_filename, old_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if histfile
        write_file_to_disk(self.history_tsd_filename, hist_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
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

  def delete_files_from_disk

    begin
      File.delete(path(self.new_forecast_tsd_filename)) if self.new_forecast_tsd_filename
      File.delete(path(self.old_forecast_tsd_filename)) if self.old_forecast_tsd_filename
      File.delete(path(self.history_tsd_filename)) if self.history_tsd_filename
    rescue StandardError => e
      Rails.logger.error e.message
      return false  ## prevents destruction of the model object
    end
    true
  end

  def tsd_rel_filepath(name)
    string = self.created_at.to_s+'_'+self.id.to_s+'_'+name
    hash = Digest::MD5.new << string
    File.join('tsd_files', hash.to_s+'_'+name)
    end
end
