class DbedtUpload < ActiveRecord::Base
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

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
        XlsCsvWorker.perform_async(id, 'cats')
      end
      if series_file
        write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'DBEDT upload disk write failed'
        XlsCsvWorker.perform_async(id, 'series')
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! :active => status
  end

  def make_active
    DbedtUpload.update_all active: false
    DbedtLoadWorker.perform_async(self.id)
    self.update cats_status: 'processing'
  end

  def make_active_settings
    unless DataPoint.update_public_data_points
      logger.debug { 'FAILED to update public_data_points' }
      return false
    end
    logger.debug { 'DONE DataPoint.update_public_data_points' }
    DbedtUpload.update_all active: false
    self.update active: true, last_error: nil, last_error_at: nil
  end

  def get_status(which)
    if which == 'cats'
      cats_status
    else
      series_status
    end
  end

  def set_status(which, status)
    if which == 'cats'
      self.update_attributes(:cats_status => status)
    else
      self.update_attributes(:series_status => status)
    end
  end

  def absolute_path(which=nil)
    if which == 'cats'
      path(cats_filename)
    elsif which == 'series'
      path(series_filename)
    else
      path
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

  def load_csv(which)
    if which == 'cats'
      return load_cats_csv
    end
    load_series_csv
  end

  def load_cats_csv
    logger.debug { 'starting load_cats_csv' }
    unless cats_filename
      logger.error { "DBEDT Upload id=#{id}: no cats_filename" }
      return false
    end

    cats_csv_path = path(cats_filename).change_file_extension('csv')
    unless File.exists?(cats_csv_path) || ENV['OTHER_WORKER'] && system("rsync -t #{ENV['OTHER_WORKER'] + ':' + cats_csv_path} #{absolute_path}")
      logger.error { "DBEDT Upload id=#{id}: couldn't find file #{cats_csv_path}" }
      return false
    end

    # clean out the things, but not the root category
    Category.where('universe = "DBEDT" and ancestry is not null').delete_all
    DataList.where(universe: 'DBEDT').destroy_all
    category = nil
    CSV.foreach(cats_csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      # category entry
      indicator_id = row[3]
      parent_indicator_id = row[4]
      parent_label = "DBEDT_#{parent_indicator_id}"
      if row[2].blank?
        category = Category.find_by(meta: "DBEDT_#{indicator_id}")
        if category.nil?
          ancestry = Category.find_by(name: 'DBEDT Data Portal', ancestry: nil).pluck(:id) || raise('No DBEDT root category found')
          unless parent_indicator_id.nil?
            parent_category = Category.find_by(meta: parent_label)
            unless parent_category.nil?
              ancestry = parent_category.ancestry + '/' + parent_category.id.to_s
            end
          end
          category = Category.create(
              meta: "DBEDT_#{indicator_id}",
              universe: 'DBEDT',
              name: row[1],
              ancestry: ancestry,
              list_order: row[5]
          )
          logger.info { "DBEDT Upload id=#{id}: created category #{category.meta} in universe #{category.universe}" }
        end
      end

      # data_list_measurements entry
      unless row[2].blank?
        data_list = DataList.find_by(name: parent_label)
        if data_list.nil?
          data_list = DataList.create(name: parent_label, universe: 'DBEDT')
          unless category.nil?
            category.update data_list_id: data_list.id
          end
        end
        measurement = Measurement.find_by(prefix: "DBEDT_#{indicator_id}")
        if measurement.nil?
          measurement = Measurement.create(
              universe: 'DBEDT',
              prefix: "DBEDT_#{indicator_id}",
              data_portal_name: row[0]
          )
        else
          measurement.update data_portal_name: row[0]
        end
        if data_list.measurements.where(id: measurement.id).empty?
          data_list.measurements << measurement
        end
        dlm = DataListMeasurement.find_by(data_list_id: data_list.id, measurement_id: measurement.id)
        dlm.update(list_order: row[5].to_i) if dlm
        logger.debug { "added measurement #{measurement.prefix} to data_list #{data_list.name}" }
      end
    end
    true
  end

  def load_series_csv(run_active_settings=false)
    logger.debug { 'starting load_series_csv' }
    unless series_filename
      logger.error { "DBEDT Upload id=#{id}: no series_filename" }
      return false
    end

    series_csv_path = path(series_filename).change_file_extension('csv')
    unless File.exists?(series_csv_path) || ENV['OTHER_WORKER'] && system("rsync -t #{ENV['OTHER_WORKER'] + ':' + series_csv_path} #{absolute_path}")
      logger.error { "DBEDT Upload id=#{id}: couldn't find file #{series_csv_path}" }
      return false
    end

    # if data_sources exist => set their current: true
    if DataSource.where("eval LIKE 'DbedtUpload.load(#{id},%)'").count > 0
      logger.debug { 'DBEDT data already loaded' }
      DbedtUpload.connection.execute %Q|UPDATE data_points SET current = 0
WHERE data_points.data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'DbedtUpload.load(%)');|
      DbedtUpload.connection.execute %Q|UPDATE data_points SET current = 1
WHERE data_points.data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'DbedtUpload.load(#{id},%)');|
      return true
    end

    logger.debug { 'loading DBEDT data' }
    current_series = nil
    current_data_source = nil
    current_measurement = nil
    data_points = []
    CSV.foreach(series_csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      prefix = "DBEDT_#{row[0]}"
      name = prefix + '@' + get_geo_code(row[3]) + '.' + row[4]
      if current_measurement.nil? || current_measurement.prefix != prefix
        current_measurement = Measurement.find_by prefix: prefix
        if current_measurement.nil?
          current_measurement = Measurement.create(
              universe: 'DBEDT',
              prefix: prefix,
              data_portal_name: row[1]
          )
        end
      end

      if current_series.nil? || current_series.name != name
        # need a fresh data_source for each series unless I make series - data_sources a many-to-many relationship
        source_id = Source.get_or_new_dbedt(row[9]).id
        current_series = Series.find_by name: name
        if current_series.nil?
          current_series = Series.create(
              universe: 'DBEDT',
              name: name,
              frequency: row[4],
              description: row[1],
              dataPortalName: row[1],
              unitsLabel: row[8],
              unitsLabelShort: row[8],
              source_id: source_id,
              measurement_id: current_measurement.id,
              decimals: row[10],
              units: 1
          )
        end
        current_data_source = DataSource.find_by eval: "DbedtUpload.load(#{id}, #{current_series.id})"
        if current_data_source.nil?
          current_data_source = DataSource.create(
              universe: 'DBEDT',
              eval: "DbedtUpload.load(#{id}, #{current_series.id})",
              description: "DBEDT Upload #{id} for series #{current_series.id}",
              series_id: current_series.id,
              last_run: Time.now
          )
        end
        current_data_source.update last_run_in_seconds: Time.now.to_i
      end
      data_points.push({series_id: current_series.id, data_source_id: current_data_source.id, date: get_date(row[5], row[6]), value: row[7]})
    end
    if data_points.length > 0 && !current_series.nil?
      data_points.in_groups_of(1000) do |dps|
        values = dps.compact.uniq{|dp|
          dp[:series_id].to_s + dp[:data_source_id].to_s + dp[:date].to_s
        }.map {|dp|
          "('DBEDT',#{dp[:series_id]},#{dp[:data_source_id]},NOW(),STR_TO_DATE('#{dp[:date]}', '%Y-%m-%d'),#{dp[:value]},false)"
        }.join(',')
        DbedtUpload.connection.execute(%Q|INSERT INTO data_points (universe, series_id, data_source_id, created_at, date, value, current) VALUES #{values};|)
      end
    end
    dbedt_data_sources = DataSource.where('eval LIKE "DbedtUpload.load(%)"').pluck(:id)
    DataPoint.where(data_source_id: dbedt_data_sources).update_all(current: false)
    new_dbedt_data_sources = DataSource.where("eval LIKE 'DbedtUpload.load(#{id},%)'").pluck(:id)
    DataPoint.where(data_source_id: new_dbedt_data_sources).update_all(current: true)

    run_active_settings ? self.make_active_settings : true
  end

  def DbedtUpload.load(id, series_id)
    du = DbedtUpload.find_by(id: id)
    du.load_series_csv(true)
  end

private
  def path_prefix
    'dbedt_files'
  end

  def path(name=nil)
    parts = [ENV['DATA_PATH'], path_prefix]
    parts.push(name) unless name.blank?
    File.join(parts)
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

  def delete_data_and_data_sources
    DbedtUpload.connection.execute %Q|DELETE FROM data_points
WHERE data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'DbedtUpload.load(#{self.id},%)');|
    DataSource.where("eval LIKE 'DbedtUpload.load(#{self.id},%)'").delete_all
  end

  def get_geo_code(name)
    trans_hash = {
        'Hawaii County' => 'HAW',
        'Honolulu County' => 'HON',
        'Maui County' => 'MAU',
        'Kauai County' => 'KAU',
        'Statewide' => 'HI',
    }
    trans_hash[name] || 'ERROR'
  end

  def get_date(year, qm)
    if qm =~ /^M(\d+)/i
      "#{year}-%02d-01" % $1.to_i
    elsif qm =~ /^Q(\d+)/i
      quarter_month = '%02d' % (($1.to_i - 1) * 3 + 1)
      "#{year}-#{quarter_month}-01"
    elsif qm.nil? || qm.empty? || qm =~ /A/i
      "#{year}-01-01"
    else
      "#{year}-12-31"  ## use this as an error code? :=}
    end
  end

end
