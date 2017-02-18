class DbedtUpload < ActiveRecord::Base
  require 'date'
  before_destroy :delete_files_from_disk

  def store_upload_files(cats_file, series_file)
    cats_file_content = cats_file.read if cats_file
    series_file_content = series_file.read if series_file

    cats_file_ext = cats_file.original_filename.split('.')[-1]
    series_file_ext = series_file.original_filename.split('.')[-1]
    self.cats_filename = DbedtUpload.make_filename('cats', cats_file_ext)
    self.series_filename = DbedtUpload.make_filename('series', series_file_ext)

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

  def DbedtUpload.make_latest_active
    uploads = DbedtUpload.all.order('upload_at desc')
    if uploads && uploads.first
      uploads.first.make_active
    end
  end

  def make_active
    active = DbedtUpload.where(active: true).first
    active.update! active: false if !active.nil?
    self.update! active: true
  end

  def cats_file_abspath
    path(cats_filename)
  end

  def series_file_abspath
    path(series_filename)
  end

  def retrieve_cats_file
    read_file_from_disk(cats_filename)
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_cats_file
    if cats_filename && File.exists?(cats_file_abspath)
      return delete_file_from_disk(cats_filename)
    end
    true
  end

  def delete_series_file
    if series_filename && File.exists?(series_file_abspath)
      return delete_file_from_disk(series_filename)
    end
    true
  end

private
  def path_prefix
    'dbedt_files'
  end

  def path(name)
    File.join(ENV['DATA_PATH'], path_prefix, name)
  end

  def DbedtUpload.make_filename(type, ext)
    ## a VERY rough heuristic for whether we have a correct file extention
    ext = ext.length > 4 ? '' : '.'+ext
    Time.now.localtime.strftime('%Y-%m-%d_%H:%M:%S')+'_'+type+ext
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

end
