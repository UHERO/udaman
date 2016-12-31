class TsdFile < ActiveRecord::Base
  require 'digest/md5'
  belongs_to :forecast_snapshot
  before_destroy :delete_from_disk

  def TsdFile.path_prefix
    'tsd_files'
  end

  def store_tsd(filecontent)
    begin
      self.save or raise StandardError, 'TSD object save failed'
      self.write_to_disk(filecontent) or raise StandardError, 'TSD file disk write failed'
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def retrieve_content
    read_from_disk
  end

private
  def write_to_disk(content)
    path = File.join(ENV['DATA_PATH'], tsd_rel_filepath(self.filename, true))
    begin
      File.open(path, 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
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
      puts ">>>>>>> dEBUF path=#{path}"
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
      return false  ## prevents destruction of the model object
    end
	return true
  end

  def tsd_rel_filepath(name)
    string = self.created_at.to_s+'_'+self.forecast_snapshot_id.to_s+'_'+name
    hash = Digest::MD5.new << string
    File.join(TsdFile.path_prefix, hash.to_s+'_'+name)
  end
end
