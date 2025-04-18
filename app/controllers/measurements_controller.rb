class MeasurementsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_measurement, only: [:show, :edit, :update, :edit_as_text, :save_as_text, :import_clip, :add_clip,
                                         :add_series, :remove_series, :duplicate, :propagate]

  ALL_PROPAGATE_FIELDS = [
      ['Data portal name', :data_portal_name],
      ['Units', :unit_id],
      ['Source', :source_id],
      ['Source detail', :source_detail_id],
      ['Source link', :source_link],
      ['Seasonal adjustment', :seasonal_adjustment],
      ['Percent', :percent],
      ['Real', :real],
      ['Decimals', :decimals],
      ['Restricted', :restricted],
      ['Frequency transform', :frequency_transform]
  ]

  # GET /measurements
  def index
    @universe = params[:u].upcase rescue 'UHERO'
    @measurements = Measurement.where(universe: @universe).order(:prefix).all
  end

  # GET /measurements/1
  def show
  end

  # GET /measurements/new
  def new
    data_list = DataList.find(params[:data_list_id].to_i) rescue nil
    @data_list_id = data_list && data_list.id
    @universe = data_list.universe rescue params[:universe].upcase rescue 'UHERO'
    @measurement = Measurement.new(universe: @universe)
    set_resource_values(@universe)
  end

  # GET /measurements/1/edit
  def edit
    set_resource_values(@measurement.universe)
  end

  # POST /measurements
  def create
    raise 'No prefix specified' if measurement_params[:prefix].blank?
    @measurement = Measurement.new(measurement_params)
    if @measurement.save
      data_list = DataList.find(params[:data_list_id]) rescue nil
      if data_list
        data_list.add_measurement(@measurement)
        redirect_to(edit_data_list_path(data_list))
      else
        redirect_to(@measurement, notice: 'Measurement was successfully created.')
      end
    else
      render(:new)
    end
  end

  def duplicate
    new_measurement = @measurement.dup
    new_measurement.prefix = @measurement.prefix + ' (copy)'
    new_measurement.series = @measurement.series
    new_measurement.save
    set_resource_values(@measurement.universe)
    redirect_to(edit_measurement_path(new_measurement.id))
  end

  # PATCH/PUT /measurements/1
  def update
    if @measurement.update(measurement_params)
      redirect_to(@measurement, notice: 'Measurement was successfully updated.')
    else
      render(:edit)
    end
  end

  def edit_as_text
    @series_list = @measurement.series.map(&:name).sort.join("\n")
  end

  def save_as_text
    box_content = params[:edit_box].split(' ')
    @measurement.replace_all_series(box_content)
    redirect_to(edit_measurement_path(@measurement))
  end

  def import_clip
    current_user.series.sort_by(&:name).each do |s|
      @measurement.series.push(s) rescue next   ## rescue to cover cases where the series is already linked
    end
    redirect_to(edit_as_text_measurement_path(@measurement))
  end

  def add_clip
    count = current_user.add_series(@measurement.series)
    redirect_to(edit_measurement_path(@measurement), notice: "#{count} series added to clipboard")
  end

  def add_series
    series = Series.find(params[:series_id])
    unless series.universe == @measurement.universe
      redirect_to(new_alias_series_path(series, new_univ: @measurement.universe, add_to_meas: @measurement.id))
      return
    end
    set_resource_values(@measurement.universe)
    if @measurement.series.include? series
      redirect_to(edit_measurement_path(@measurement.id), notice: 'This series is already included!')
      return
    end
    @measurement.series << series
    respond_to do |format|
      format.html { redirect_to(edit_measurement_path(@measurement.id)) }
      format.js {}
    end
  end

  def remove_series
    respond_to do |format|
      format.js { head :ok }
    end
    series = Series.find(params[:series_id])
    @measurement.series.delete(series)
  end

  def propagate
    fields = params[:field_boxes]
    series = params[:series_boxes]
    unless fields && series
      redirect_to(measurement_path(@measurement), notice: 'Please select at least one field and one series')
      return
    end
    allowed_fields = ALL_PROPAGATE_FIELDS.map{|f| f[1].to_s }
    fields_to_update = fields.keys.select{|f| allowed_fields.include?(f) }
    if fields_to_update.empty?
      redirect_to(measurement_path(@measurement), notice: 'No fields to update were found.')
      return
    end
    new_vals_hash = fields_to_update.map{|f| [translate(f), @measurement.read_attribute(f)] }.to_h
    series.keys.each {|name| Series.find_by(universe: @measurement.universe, name: name).update_attributes(new_vals_hash) }
    redirect_to(@measurement, notice: 'Field(s) ' + fields_to_update.join(', ') + ' propagated successfully.')
  end

private

    def set_resource_values(univ)
      @all_units = Unit.where(universe: univ)
      @all_units = Unit.where(universe: 'UHERO') if @all_units.empty?
      @all_sources = Source.where(universe: univ)
      @all_sources = Source.where(universe: 'UHERO') if @all_sources.empty?
      @all_details = SourceDetail.where(universe: univ)
      @all_details = SourceDetail.where(universe: 'UHERO') if @all_details.empty?
    end

    def translate(name)
      # Translate column names from Measurement table form to Series table form
      { 'data_portal_name' => 'dataPortalName' }[name] || name
    end

    # Use callbacks to share common setup or constraints between actions.
    def set_measurement
      @measurement = Measurement.find params[:id]
    end

    # Only allow a trusted parameter "white list" through.
    def measurement_params
      params.require(:measurement).permit(:universe, :prefix, :data_portal_name, :table_prefix, :table_postfix,
                                          :unit_id, :percent, :real, :notes, :restricted, :series_id, :decimals,
                                          :seasonally_adjusted, :seasonal_adjustment, :frequency_transform,
                                          :source_detail_id, :source_id, :source_link,
                                          :field_boxes, :series_boxes)
    end
end
