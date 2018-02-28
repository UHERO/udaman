class DataListsController < ApplicationController
  include Authorization

  MAXINDENT = 3

  before_action :check_data_list_authorization

  # GET /data_lists
  # GET /data_lists.xml
  def index
    @data_lists = DataList.where(universe: 'UHERO').order(:name).all

    respond_to do |format|
      format.html # index.html.erb
      format.xml  { render :xml => @data_lists }
    end
  end

  # GET /data_lists/1
  def show
    @freq = params[:freq]
    @freq ||= 'A'
    @county = params[:county]
    @county ||= 'HI'
    @seasonally_adjusted = params[:seasonally_adjusted] || 'T'
    @data_list = DataList.find_by id: params[:id]
    render 'super_table'
  end
  
  def super_table
    @freq = params[:freq]
    @freq ||= 'A'
    @county = params[:county]
    @county ||= 'HI'
    @seasonally_adjusted = params[:seasonally_adjusted] || 'T'
    @data_list = DataList.find_by id: params[:id]
    # @series_to_chart = @data_list.series_names
    # frequency = @series_to_chart[0][-1]
    # dates = set_dates(frequency, params)
    # @start_date = dates[:start_date]
    # @end_date = dates[:end_date]
    render 'super_table'
  end
  
  def show_table
    @data_list = DataList.find_by id: params[:id]
    @series_to_chart = @data_list.series_names
    if @series_to_chart.length == 0
      render 'tableview'
      return
    end
    frequency = @series_to_chart[0][-1]
    dates = set_dates(frequency, params)
    @start_date = dates[:start_date]
    @end_date = dates[:end_date]
    render 'tableview'
  end

#NOTE DATA LIST NEEDS TO BE ALL CAPS... SOMETHING TO FIX. Not the case for regular super table
  def show_tsd_super_table
    @data_list = DataList.find_by id: params[:id]
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @tsd_file = params[:tsd_file].nil? ? @all_tsd_files[0] : params[:tsd_file]
    render 'tsd_super_tableview'
  end
  
  def show_tsd_table
    @data_list = DataList.find_by id: params[:id]
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @tsd_file = params[:tsd_file].nil? ? @all_tsd_files[0] : params[:tsd_file]
    @series_to_chart = @data_list.series_names
    frequency = @series_to_chart[0][-1]
    dates = set_dates(frequency, params)
    @start_date = dates[:start_date]
    @end_date = dates[:end_date]
    render 'tsd_tableview'
  end
  
  def analyze_view
    @data_list = DataList.find_by id: params[:id]
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @tsd_file = params[:tsd_file].nil? ? @all_tsd_files[0] : params[:tsd_file]
    @series_name = params[:list_index].nil? ? params[:series_name] : @data_list.series_names[params[:list_index].to_i]
    #@series_name = @data_list.series_names[@series_index]

    @data = json_from_heroku_tsd(@series_name,@tsd_file)
		@series = @data.nil? ? nil : Series.new_transformation(@data['name']+'.'+@data['frequency'],  @data['data'], Series.frequency_from_code(@data['frequency']))
		@chg = @series.annualized_percentage_change
    #@as = AremosSeries.get @series.name 
    @desc = 'None yet' #@as.nil? ? 'No Aremos Series' : @as.description
    @lvl_chg = @series.absolute_change
    @ytd = @series.ytd_percentage_change
  end
  
  def compare_forecasts
    @data_list = DataList.find_by id: params[:id]
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
  end
  
  def compare_view
    @data_list = DataList.find_by id: params[:id]
    @tsd_file1 = 'heco14.TSD'
    @tsd_file2 = '13Q4.TSD'
    @series_name = params[:list_index].nil? ? params[:series_name] : @data_list.series_names[params[:list_index].to_i]

    @data1 = json_from_heroku_tsd(@series_name,@tsd_file1)
		@series1 = @data1.nil? ? nil : Series.new_transformation(@data1['name']+'.'+@data1['frequency'],  @data1['data'], Series.frequency_from_code(@data1['frequency'])).trim('2006-01-01','2017-10-01')
		@chg1 = @series1.annualized_percentage_change
    
    @data2 = json_from_heroku_tsd(@series_name,@tsd_file2)
		@series2 = @data2.nil? ? nil : Series.new_transformation(@data2['name']+'.'+@data2['frequency'],  @data2['data'], Series.frequency_from_code(@data2['frequency'])).trim('2006-01-01','2017-10-01')
		@chg2 = @series2.annualized_percentage_change

    @history_series = @series_name.ts.trim('2006-01-01','2017-10-01')
    @history_chg = @history_series.annualized_percentage_change
  end
  
  # GET /data_lists/new
  # GET /data_lists/new.xml
  def new
    @category_id = Category.find(params[:category_id]).id rescue nil
    @data_list = DataList.new

    respond_to do |format|
      format.html # new.html.erb
      format.xml  { render :xml => @data_list }
    end
  end

  def duplicate
    original_data_list = DataList.find_by id: params[:id]
    new_data_list = original_data_list.dup
    new_data_list.name = original_data_list.name + ' (copy)'
    new_data_list.measurements = original_data_list.measurements
    new_data_list.save
    redirect_to edit_data_list_url(new_data_list.id)
  end

  # GET /data_lists/1/edit
  def edit
    @dl_measurements = []
    @data_list = DataList.find_by id: params[:id]
    @data_list.data_list_measurements.sort_by{|m| m.list_order}.each do |dlm|
        if dlm.measurement.nil?
          @data_list.data_list_measurements.destroy(dlm)
          next
        end
        @dl_measurements << [dlm.measurement, dlm.indent]
    end
  end

  # POST /data_lists
  # POST /data_lists.xml
  def create
    properties = data_list_params.merge(created_by: current_user.id, updated_by: current_user.id, owned_by: current_user.id)
    category = Category.find(params[:category_id]) rescue nil
    properties.merge!(universe: category.universe) if category
    @data_list = DataList.new(properties)

    respond_to do |format|
      if @data_list.save
        format.html {
          if category
            category.update_attributes(data_list_id: @data_list.id)
            redirect_to edit_category_path(category)
          else
            redirect_to(@data_list, notice: 'Data list was successfully created.')
          end
        }
        format.xml  { render :xml => @data_list, :status => :created, :location => @data_list }
      else
        format.html { render :action => 'new' }
        format.xml  { render :xml => @data_list.errors, :status => :unprocessable_entity }
      end
    end
  end

  # PUT /data_lists/1
  # PUT /data_lists/1.xml
  def update
    @data_list = DataList.find_by id: params[:id]

    respond_to do |format|
      puts params[:data_list]
      if @data_list.update! data_list_params.merge({ :updated_by => current_user.id })
        format.html { redirect_to(@data_list, :notice => 'Data list was successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render :action => 'edit' }
        format.xml  { render :xml => @data_list.errors, :status => :unprocessable_entity }
      end
    end
  end

  # DELETE /data_lists/1
  # DELETE /data_lists/1.xml
  def destroy
    @data_list = DataList.find_by id: params[:id]
    @data_list.destroy

    respond_to do |format|
      format.html { redirect_to(data_lists_url) }
      format.xml  { head :ok }
    end
  end

  def add_measurement
    @data_list = DataList.find_by id: params[:id].to_i
    measurement = Measurement.find_by id: params[:data_list][:measurement_ids].to_i
    if @data_list.measurements.include?(measurement)
      redirect_to edit_data_list_url(@data_list.id), notice: 'This Measurement is already in the list!'
      return
    end
    last_dlm = DataListMeasurement.where(data_list_id: @data_list.id).order('list_order desc').first
    list_order = last_dlm ? last_dlm.list_order : 0
    indent = last_dlm && last_dlm.indent ? last_dlm.indent : 'indent0'
    @data_list.measurements<< measurement
    DataListMeasurement.find_by(data_list_id: @data_list.id,
                                measurement_id: measurement.id).update(list_order: list_order + 1, indent: indent)
    respond_to do |format|
      format.html { redirect_to edit_data_list_url(@data_list.id) }
      format.js {}
    end
  end
  
  def move_measurement_up
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    @data_list = DataList.find_by id: params[:id]
    puts "trying to move measurement #{params[:measurement_id]} up."
    measurements_array = @data_list.data_list_measurements.to_a.sort_by{ |m| m.list_order }
    old_index = measurements_array.index{ |m| m.measurement_id == params[:measurement_id].to_i }
    if old_index <= 0
      return
    end
    measurements_array.each_index do |i|
      if old_index - 1 == i
        measurements_array[i].update list_order: i + 1
        next
      end
      if old_index == i
        measurements_array[i].update list_order: i - 1
        next
      end
      measurements_array[i].update list_order: i
    end
  end

  def move_measurement_down
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    @data_list = DataList.find_by id: params[:id]
    puts "trying to move measurement #{params[:measurement_id]} down."
    measurements_array = @data_list.data_list_measurements.to_a.sort_by{ |m| m.list_order }
    old_index = measurements_array.index{ |m| m.measurement_id == params[:measurement_id].to_i }
    if old_index >= measurements_array.length - 1
      return
    end
    measurements_array.each_index do |i|
      if old_index + 1 == i
        measurements_array[i].update list_order: i - 1
        next
      end
      if old_index == i
        measurements_array[i].update list_order: i + 1
        next
      end
      measurements_array[i].update list_order: i
    end
  end

  def remove_measurement
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    measurements = DataListMeasurement.where(data_list_id: params[:id]).to_a.sort_by{ |m| m.list_order }
    index_to_remove = measurements.index{ |m| m.measurement_id == params[:measurement_id].to_i }
    new_order = 0
    measurements.each_index do |i|
      if index_to_remove == i
        next
      end
      measurements[i].update list_order: new_order
      new_order += 1
    end
    id_to_remove = DataListMeasurement.find_by(data_list_id: params[:id], measurement_id: params[:measurement_id]).id
    DataListMeasurement.destroy(id_to_remove)
  end

  def set_measurement_indent
    dlm = DataListMeasurement.find_by(data_list_id: params[:id], measurement_id: params[:measurement_id])
    current_indent = dlm.indent ? dlm.indent[-1].to_i : 0
    new_indent = params[:indent_in_out] == 'in' ? current_indent + 1 : current_indent - 1
    if new_indent < 0 || new_indent > MAXINDENT
      respond_to do |format|
        format.js { render nothing: true, status: 200 }
      end
      return
    end
    respond_to do |format|
      format.json { render json: '{ "the_indent": "%s" }' % view_context.make_indentation(new_indent), status: 200 }
    end
    dlm.update(indent: 'indent'+new_indent.to_s)
  end

  private
    def data_list_params
      params.require(:data_list)
          .permit(:name, :list, :startyear, :created_by, :updated_by, :owned_by, :measurements, :measurement_id, :indent_in_out)
    end

    def set_dates(frequency, params)
      case frequency
        when 'M', 'm'
          months_back = 15
          offset = 1
        when 'Q', 'q'
          months_back = 34
          offset = 4
        when 'A', 'a'
          months_back = 120
          offset = 4
        else
          return nil
      end

      if params[:num_years].nil?
        start_date = (Time.now.to_date << (months_back))
        end_date = nil
      else
        start_date = (Time.now.to_date << (12 * params[:num_years].to_i + offset))
        end_date = nil
      end
      {:start_date => start_date, :end_date => end_date}
    end

    def json_from_heroku_tsd(series_name, tsd_file)
      url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{series_name[0..-3]}/json")
      res = Net::HTTP.new(url.host, url.port).request_get(url.path)
      res.code == '500' ? nil : JSON.parse(res.body)
    end
end
