class DbedtUpload < ActiveRecord::Base
  require 'date'
  before_destroy :delete_files_from_disk

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(cats_file, series_file)
    now = Time.now.localtime
    if cats_file
      cats_file_content = cats_file.read
      cats_file_ext = cats_file.original_filename.split('.')[-1]
      self.cats_filename = DbedtUpload.make_filename(now, 'cats', cats_file_ext)
      self.cats_status = :processing
    end
    if series_file
      series_file_content = series_file.read
      series_file_ext = series_file.original_filename.split('.')[-1]
      self.series_filename = DbedtUpload.make_filename(now, 'series', series_file_ext)
      self.series_status = :processing
    end

    self.upload_at = Time.now
## validate file content
    begin
      self.save or raise StandardError, 'DBEDT upload object save failed'
      if cats_file
        write_file_to_disk(cats_filename, cats_file_content) or raise StandardError, 'DBEDT upload disk write failed'
        XlsCsvWorker.perform_async(self.id, 'cats')
      end
      if series_file
        write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'DBEDT upload disk write failed'
        XlsCsvWorker.perform_async(self.id, 'series')
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    puts ">>>>> DEBUG:: setting active status to #{status}"

    if status == 'loading'
      DbedtUpload.where(:active => 'yes').update_all :active => 'no'
      DbedtLoadWorker.perform_async(self.id)
    end
    self.update! :active => status
  end

  def get_status(which)
    if which == 'cats'
      self.cats_status
    else
      self.series_status
    end
  end

  def set_status(which, status)
    if which == 'cats'
      self.update_attributes(:cats_status => status)
    else
      self.update_attributes(:series_status => status)
    end
  end

  def absolute_path(which)
    if which == 'cats'
      path(cats_filename)
    else
      path(series_filename)
    end
  end

  def retrieve_cats_file
    read_file_from_disk(cats_filename)
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_cats_file
    if cats_filename && File.exists?(absolute_path('cats'))
      r = true
      Dir.glob(absolute_path('cats').change_file_extension('*')) do |f|
        r &&= delete_file_from_disk(f)
      end
      return r
    end
    true
  end

  def delete_series_file
    if series_filename && File.exists?(absolute_path('series'))
      r = true
      Dir.glob(absolute_path('series').change_file_extension('*')) do |f|
        r &&= delete_file_from_disk(f)
      end
      return r
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

  def DbedtUpload.make_filename(time, type, ext)
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
    delete_cats_file && delete_series_file
  end

end
