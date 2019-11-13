class Download < ApplicationRecord
  include Cleaning
  has_many :data_source_downloads, dependent: :delete_all
  has_many :data_sources, -> {distinct}, through: :data_source_downloads
  has_many :dsd_log_entries

  require 'rest-client'

  serialize :post_parameters, Hash
  serialize :download_log, Array

  after_create do
    ## Mainly needed for spec tests
    unless File::directory?(File.dirname(self.save_path))
      FileUtils.mkdir_p(File.dirname(self.save_path))
    end
  end

  DEFAULT_DATA_PATH = '/Users/uhero/Documents/data'

  def Download.default_data_path
    DEFAULT_DATA_PATH
  end

  def Download.get(handle)
    Download.where(:handle => handle).first
  end

  def Download.test_url(url)
    dsd = Download.new(:url => url)
    dsd.test_url
  end

  def Download.test_save_path(save_path)
    file_parts = File.basename(save_path).split('.')
    ext = file_parts.pop
    Download.new(handle: file_parts.join('.'), filename_ext: ext).test_save_path
  end

  def Download.test_post_params(params)
    begin
      Download.new.test_process_post_params(params)
    rescue SyntaxError
      return false
    end
    true
  end
  #used this in the other script that downloaded https files
  #but this script doesn't appear to need it
  #client.ssl_config.set_trust_ca('ca.secure.webapp.domain.com.crt')


  def Download.upd(options)
    dsd = Download.where(:handle => options['handle']).first
    if dsd.nil?
      Download.create(options)
    else
      options.delete('handle')
      dsd.update_attributes(options)
    end
  end

  def update_statement
    "Download.upd(#{self.attributes.select {|_, value| !value.is_a? Time}})"
  end

  def save_path(no_ext = false)
    save_path_flex(no_ext)
  end

  def save_path_flex(no_ext = false)
    if no_ext
      File.join(Download.root, sanitize_handle)
    else
      File.join(Download.root, '%s.%s' % [sanitize_handle, filename_ext || 'ext'])
    end
  end

  def extract_path_flex
    file_to_extract && File.join(Download.root, sanitize_handle, file_to_extract)
  end

  def Download.root
    File.join(ENV['DATA_PATH'], 'rawdata')
  end

  def sanitize_handle
    handle ? handle.gsub('@','_') : 'NO_HANDLE_DEFINED'
  end

  def download
    Rails.logger.debug { '... Entered method Download.download' }
    if self.freeze_file
      Rails.logger.info { "Download handle #{handle} temporarily frozen - not downloading" }
      return nil
    end
    if post_parameters.blank?
      Rails.logger.debug { "... Calling RestClient to get #{url.strip}" }
      resp = RestClient.get URI.encode(url.strip)
    else
      Rails.logger.debug { "... Calling RestClient to get #{url.strip} with post_parameters=#{post_parameters.strip}" }
      resp = RestClient.post URI.encode(url.strip), post_parameters.strip
    end
    status = resp.code
    data_changed = false
    if status == 200
      now = Time.now
      Rails.logger.debug { '... RestClient download succeeded (status 200)' }
      update_times = { last_download_at: now }
      data_changed = content_changed?(resp.to_str)
      if data_changed || last_change_at.nil?
        backup
        update_times.merge!(last_change_at: now)
      end
      begin
        open(save_path, 'wb') {|f| f.write resp.to_str }
        if filename_ext == 'zip'
          save_path.unzip(file_to_extract)
        end
      rescue => e
        Rails.logger.error "File download storage: #{e.message}"
      end
      self.update(update_times)
    end

    download_time = Time.now
    download_url = url
    download_location = resp.headers['Location']
    content_type = resp.headers['Content-Type']
    last_log = dsd_log_entries.order(:time).last

    if last_log.nil? or !(last_log.url == download_url and last_log.time.to_date == download_time.to_date and last_log.status == status)
      self.dsd_log_entries.create!(:time => download_time, :url => download_url, :location => download_location, :mimetype => content_type, :status => status, :dl_changed => data_changed)
      Rails.logger.debug { "... dsd_log_entry created in db" }
    end

    #this return might be a little misleading since it isn't always the exact results of the last download, just an indication that they were mostly the same
    dsd_log_entries.order(:time).last
  end

  def content_changed?(new_content)
    return true if !File::exists? save_path_flex
    current_content = open(save_path_flex, 'rb').read
    new_content != current_content
  end

  def backup
    filepath = save_path
    return if !File::exists? filepath
    vintages_path = filepath + '_vintages'
    Dir.mkdir vintages_path unless File::directory? vintages_path
    newname = "#{Date.today}_#{File.basename(filepath)}"
    FileUtils.cp(filepath, File.join(vintages_path, newname))
  end

  def test_process_post_params(post_param)
    begin
      self.post_parameters = eval %Q|{#{post_param}}|
    end
  end

  def process_post_params(post_param)
    begin
      self.post_parameters = eval %Q|{#{post_param}}|
      self.save
    rescue => e
      raise ProcessPostParamException, e.message
    end
  end

  def post_param_string
    return "" if post_parameters.nil?
    string = ""
    post_parameters.sort.each do |key,value|
      string += %Q|'#{key}'=>'#{value}',\n|
    end
    string.chop.chop
  end

  def test_url
    begin
      client = HTTPClient.new
      client.agent_name = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:9.0) Gecko/20100101 Firefox/9.0'
      resp = client.get url, follow_redirect: true
      resp.header.status_code
    rescue
      return nil
    end
  end

  def test_save_path
    return 'nopath' if save_path.nil?
    return 'badpath' unless File::directory?(File.dirname(save_path))
    Download.all.each do |dl|
      return 'duplicate' if dl.id != self.id && dl.save_path == self.save_path
    end
    'ok'
  end
end
