class TsdFile < ActiveRecord::Base
  belongs_to :forecast_snapshot

  def TsdFile.path_prefix
    'tsd_files'
  end

  def write_to_disk(content)
    path = File.join(ENV['DATA_PATH'], tsd_rel_filepath(self.filename))
    begin
      File.open(path, 'wb') { |f| f.write(filecontent) }
    rescue StandardError => e
      Rails.logger.error e.message
      redirect_to forecast_snapshot_path(self.forecast_snapshot),
          notice: "Failed to write TSD file #{path}: #{e.message}"
      return false
    end
	return true
  end

  def read_from_disk
    path = File.join(ENV['DATA_PATH'], tsd_rel_filepath(self.filename))
    begin
      content = File.open(path, 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      redirect_to forecast_snapshot_path(self.forecast_snapshot),
          notice: "Failed to read TSD file #{path}: #{e.message}"
      return false
    end
	return content
  end

  def delete_from_disk
    path = File.join(ENV['DATA_PATH'], tsd_rel_filepath(self.filename))
    begin
      File.delete(path)
    rescue StandardError => e
      Rails.logger.error e.message
      redirect_to forecast_snapshot_path(self.forecast_snapshot),
          notice: "Failed to remove TSD file #{path}: #{e.message}"
      return false
    end
	return content
  end

private
  def tsd_rel_filepath(name)
    string = self.created_at.to_s+'_'+self.forecast_snapshot_id.to_s+'_'+name
    hash = Digest.MD5 << string
    File.join(TsdFile.path_prefix, hash.to_s+'_'+name)
  end
end
