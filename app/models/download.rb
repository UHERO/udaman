class Download < ActiveRecord::Base
  has_many :data_source_downloads, dependent: :delete_all
  has_many :data_sources, -> {distinct}, through: :data_source_downloads
  has_many :dsd_log_entries

  require 'rest-client'

  serialize :post_parameters, Hash
  serialize :download_log, Array

  DEFAULT_DATA_PATH = '/Users/uhero/Documents/data'

  def Download.default_data_path
    DEFAULT_DATA_PATH
  end

  #some tight coupling to the unizipping functionality in the string extension
  def Download.get_by_path(save_path)
    sp = save_path.split('_extracted_files/')[0]
    Download.where(:save_path => sp).first
  end

  def Download.get(handle)
    Download.where(:handle => handle).first
  end

  def Download.test_url(url)
    dsd = Download.new(:url => url)
    dsd.test_url
  end

  def Download.test_save_path(save_path)
    dsd = Download.new(:save_path => save_path)
    dsd.test_save_path
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

  def save_path_flex
    return save_path.gsub(DEFAULT_DATA_PATH, ENV['DATA_PATH']) if save_path.include? DEFAULT_DATA_PATH
    save_path
  end

  def extract_path_flex
    return file_to_extract.gsub(DEFAULT_DATA_PATH, ENV['DATA_PATH']) if !file_to_extract.nil? && file_to_extract.include?(DEFAULT_DATA_PATH)
    file_to_extract
  end

  def Download.flex(path)
    path
  end

  #this needs to be fixed
  def download_changed?
    self.download
    true
  end

  def download
    resp = nil
    logger.debug { '... Entered method dsd.download' }
    if post_parameters.nil? or post_parameters.length == 0
      logger.debug { "... Calling RestClient to get #{url.strip}" }
      resp = RestClient.get URI.encode(url.strip)
    else
      logger.debug { "... Calling RestClient to get #{url.strip} with post_parameters=#{post_parameters}" }
      resp = RestClient.post URI.encode(url.strip), post_parameters
    end
    status = resp.code
    data_changed = false
    if status == 200
      logger.debug { '... RestClient download succeeded (status 200)' }
      data_changed = content_changed?(resp.to_str)
      backup if data_changed
      open(save_path_flex, 'wb') { |file| file.write resp.to_str }
      save_path_flex.unzip if save_path_flex[-3..-1] == 'zip'
    end
    #logging section
    download_time = Time.now
    download_url = url
    download_location = resp.headers['Location']
    content_type = resp.headers['Content-Type']
    last_log = dsd_log_entries.order(:time).last

    if last_log.nil? or !(last_log.url == download_url and last_log.time.to_date == download_time.to_date and last_log.status == status)
      self.dsd_log_entries.create!(:time => download_time, :url => download_url, :location => download_location, :mimetype => content_type, :status => status, :dl_changed => data_changed)
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
    return if !File::exists? save_path_flex
    Dir.mkdir save_path_flex+'_vintages' unless File::directory?(save_path_flex+'_vintages')
    filename = save_path_flex.split('/')[-1]
    date = Date.today
    FileUtils.cp(save_path_flex, save_path_flex+"_vintages/#{date}_"+filename)
  end

  def test_process_post_params(post_param)
    begin
      self.post_parameters = eval %Q|{#{post_param}}|
      # rescue Exception => exc
      #   raise ProcessPostParamException
    end
  end

  def process_post_params(post_param)
    begin
      self.post_parameters = eval %Q|{#{post_param}}|
      self.save
    rescue Exception => exc
      raise ProcessPostParamException
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
    return 'duplicate' if Download.where(:save_path => save_path).count > 0
    return 'badpath' unless File::directory?(save_path.split('/')[0..-2].join('/'))
    'ok'
  end
end
