class ForecastSnapshot < ActiveRecord::Base
  ##before_destroy :delete_files_from_disk

  def path(filename)
    File.join(ENV['DATA_PATH'], tsd_rel_filepath(filename))
  end

  def store_fs(newfile = nil, oldfile = nil, histfile = nil)
    new_tsd_content = newfile.read if newfile
    old_tsd_content = oldfile.read if oldfile
    hist_tsd_content = histfile.read if histfile
## validate file content
    begin
      self.save or raise StandardError, 'FS object save failed'
      if newfile
        write_to_disk(self.new_forecast_tsd_filename, new_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if oldfile
        write_to_disk(self.old_forecast_tsd_filename, old_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if histfile
        write_to_disk(self.history_tsd_filename, hist_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

private
  def write_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_from_disk(name)
    begin
      File.delete(path(name))
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
