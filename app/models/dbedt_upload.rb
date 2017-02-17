class DbedtUpload < ActiveRecord::Base
  require 'date'
  before_destroy :delete_files_from_disk

  def DbedtUpload.path_prefix
    'dbedt_files'
  end

  def path(name)
    File.join(ENV['DATA_PATH'], DbedtUpload.path_prefix, name)
  end

  def store_upload_files(cats_file, series_file)
    cats_file_content = cats_file.read if cats_file
    series_file_content = series_file.read if series_file
    self.cats_filename = make_filename('cats')
    self.series_filename = make_filename('series')
    self.upload_at = Time.now
    self.make_active
## validate file content
    begin
      self.save or raise StandardError, 'DBEDT upload object save failed'
      if cats_file
        write_file_to_disk(cats_filename, cats_file_content) or raise StandardError, 'DBEDT upload disk write failed'
      end
      if series_file
        write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'DBEDT upload disk write failed'
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def make_active
    active = DbedtUpload.where(active: true).first
    active.update! active: false if !active.nil?
    self.update! active: true
  end

  def retrieve_content(type)
    puts "DEBUG >>>>>> enter retrieve content"
    read_file_from_disk(type)
  end

  def delete_cats_file
    cats_filename ? delete_file_from_disk(cats_filename) : true
  end

  def delete_series_file
    series_filename ? delete_file_from_disk(series_filename) : true
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
    delete_cats_file && delete_series_file
  end

  def make_filename(type)
    Time.now.localtime.strftime('%Y-%m-%d_%H:%M:%S')+'_'+type
  end

end
