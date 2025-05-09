class DataListsController < ApplicationController
  include Authorization

  MAXINDENT = 3

  before_action :check_data_list_authorization
  before_action :set_data_list, except: [:index, :new, :create]

  def index
    @universe = params[:u].upcase rescue 'UHERO'
    @data_lists = DataList.where(universe: @universe).order(:name).all

    respond_to do |format|
      format.html # index.html.erb
      format.xml  { render(xml: @data_lists) }
    end
  end

  def show
    super_table
    render(:super_table)
  end

  def super_table
    @freq = params[:freq] || 'A'
    @geo = params[:geography] || 'HI'
    @seasonally_adjusted = params[:seasonally_adjusted] || 'all'
  end

  def show_table
    @series_to_chart = @data_list.series_names
    unless @series_to_chart.empty?
      frequency = Series.parse_name(@series_to_chart[0])[:freq]
      dates = set_dates(frequency, params)
      @start_date = dates[:start_date]
      @end_date = dates[:end_date]
    end
    render(:tableview)
  end

  def show_tsd_super_table
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @tsd_file = params[:tsd_file] || @all_tsd_files[0]
    render(:tsd_super_tableview)
  end

  def show_tsd_table
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @tsd_file = params[:tsd_file] || @all_tsd_files[0]
    @series_to_chart = @data_list.series_names
    frequency = Series.parse_name(@series_to_chart[0])[:freq]
    dates = set_dates(frequency, params)
    @start_date = dates[:start_date]
    @end_date = dates[:end_date]
    render(:tsd_tableview)
  end

  def analyze_view
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @tsd_file = params[:tsd_file] || @all_tsd_files[0]
    @series_name = params[:list_index].nil? ? params[:series_name] : @data_list.series_names[params[:list_index].to_i]

    @data = json_from_heroku_tsd(@series_name,@tsd_file)
		@series = @data && Series.new_transformation(@data['name']+'.'+@data['frequency'], @data['data'], Series.frequency_from_code(@data['frequency']))
		@chg = @series.annualized_percentage_change
    #@as = AremosSeries.get @series.name
    @desc = 'None yet' #@as.nil? ? 'No Aremos Series' : @as.description
    @lvl_chg = @series.absolute_change
    @ytd = @series.ytd_percentage_change
  end

  def new
    category = Category.find(params[:category_id].to_i) rescue nil
    @category_id = category && category.id
    @universe = category.universe rescue params[:universe].upcase rescue 'UHERO'
    @data_list = DataList.new(universe: @universe)

    respond_to do |format|
      format.html # new.html.erb
      format.xml  { render(xml: @data_list) }
    end
  end

  def duplicate
    new_data_list = @data_list.dup
    new_data_list.name = @data_list.name + ' (copy)'
    new_data_list.measurements = @data_list.measurements
    new_data_list.save!
    redirect_to(edit_data_list_path(new_data_list), notice: 'Successfully Duplicated Data List')
  end

  def edit
    @dl_measurements = []
    @data_list.data_list_measurements.sort_by(&:list_order).each do |dlm|
        if dlm.measurement.nil?
          @data_list.data_list_measurements.destroy(dlm)
          next
        end
        @dl_measurements << [dlm.measurement, dlm.indent]
    end
  end

  def create
    properties = data_list_params.merge(created_by: current_user.id, updated_by: current_user.id)
    category = Category.find(params[:category_id].to_i) rescue nil
    if category
      properties.merge!(universe: category.universe)
    elsif !params[:universe].blank?
      properties.merge!(universe: params[:universe])
    end
    @data_list = DataList.new(properties)

    respond_to do |format|
      if @data_list.save
        if category
          category.update_attributes(data_list_id: @data_list.id)
        end
        format.html { redirect_to(edit_data_list_path(@data_list)) }
        format.xml  { render(xml: @data_list), status: :created, :location => @data_list }
      else
        format.html { render(action: 'new') }
        format.xml  { render(xml: @data_list).errors, status: :unprocessable_entity }
      end
    end
  end

  def update
    respond_to do |format|
      if @data_list.update! data_list_params.merge(updated_by: current_user.id)
        format.html { redirect_to(@data_list, notice: 'Data list was successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render(action: 'edit') }
        format.xml  { render(xml: @data_list).errors, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    univ = @data_list.universe
    @data_list.destroy

    respond_to do |format|
      format.html { redirect_to(data_lists_path(u: univ)) }
      format.xml  { head :ok }
    end
  end

  def edit_as_text
    @prefix_list = @data_list.data_list_measurements.order(:list_order).map {|dlm| dlm.measurement.prefix }.join("\n")
  end

  def save_as_text
    box_content = params[:edit_box].split(' ')
    @data_list.replace_all_measurements(box_content)
    redirect_to(edit_data_list_url(@data_list))
  end

  def add_clip
    count = 0
    @data_list.measurements.each do |m|
      count += current_user.add_series(m.series)
    end
    redirect_to(edit_data_list_url(@data_list), notice: "#{count} series added to clipboard")
  end

  def add_measurement
    unless @data_list.add_measurement(Measurement.find params[:data_list][:meas_id].to_i)
      redirect_to(edit_data_list_url(@data_list.id), notice: 'This Measurement is already in the list!')
      return
    end
    respond_to do |format|
      format.html { redirect_to(edit_data_list_url(@data_list.id)) }
      format.js {}
    end
  end

  # this really should be converted to a model method
  def remove_measurement
    respond_to do |format|
      format.js { head :ok }
    end
    measurements = DataListMeasurement.where(data_list_id: @data_list.id).to_a.sort_by{ |m| m.list_order }
    index_to_remove = measurements.index{ |m| m.measurement_id == params[:measurement_id].to_i }
    new_order = 0
    measurements.each_index do |i|
      if index_to_remove == i
        next
      end
      measurements[i].update list_order: new_order
      new_order += 1
    end
    id_to_remove = DataListMeasurement.find_by(data_list_id: @data_list.id, measurement_id: params[:measurement_id].to_i).id
    DataListMeasurement.destroy(id_to_remove)
  end

  # this really should be converted to a model method
  def move_measurement_up
    respond_to do |format|
      format.js { head :ok } ## only return 200 to client
    end
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

  # this really should be converted to a model method
  def move_measurement_down
    respond_to do |format|
      format.js { head :ok } ## only return 200 to client
    end
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

  # should this be converted to a model method?
  def set_measurement_indent
    dlm = DataListMeasurement.find_by(data_list_id: @data_list.id, measurement_id: params[:measurement_id].to_i)
    current_indent = dlm.indent ? dlm.indent[-1].to_i : 0
    new_indent = params[:indent_in_out] == 'in' ? current_indent + 1 : current_indent - 1
    if new_indent < 0 || new_indent > MAXINDENT
      respond_to do |format|
        format.js { head :ok } ## only return 200 to client
      end
      return
    end
    respond_to do |format|
      format.json { render json: '{ "the_indent": "%s" }' % helpers.make_indentation(new_indent), status: 200 }
    end
    dlm.update(indent: 'indent'+new_indent.to_s)
  end

private
    def set_data_list
      @data_list = DataList.find params[:id]
    end

    def data_list_params
      params.require(:data_list).permit(:name, :list, :startyear, :created_by, :updated_by, :owned_by, :measurements)
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
      {start_date: start_date, end_date: end_date}
    end

    def json_from_heroku_tsd(series_name, tsd_file)
      url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{series_name[0..-3]}/json")
      res = Net::HTTP.new(url.host, url.port).request_get(url.path)
      res.code == '500' ? nil : JSON.parse(res.body)
    end
end
