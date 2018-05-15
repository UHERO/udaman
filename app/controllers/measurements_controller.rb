class MeasurementsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_measurement, only: [:show, :edit, :update, :add_series, :remove_series,
                                         :propagate]

  ALL_PROPAGATE_FIELDS = [
      ['Data portal name', :data_portal_name],
      ['Units', :unit_id],
      ['Source', :source_id],
      ['Source detail', :source_detail_id],
      ['Source link', :source_link],
      ['Seasonally adjusted', :seasonally_adjusted],
      ['Seasonal adjustment', :seasonal_adjustment],
      ['Percent', :percent],
      ['Real', :real],
      ['Decimals', :decimals],
      ['Restricted', :restricted],
      ['Frequency transform', :frequency_transform]
  ]

  # GET /measurements
  def index
    if params[:unrestricted]
      @measurements = Measurement.where(universe: 'UHERO').includes(:series).where(:series => {:restricted => false}).order(:prefix)
      return
    end
    @measurements = Measurement.where(universe: 'UHERO').order(:prefix).all
  end

  # GET /measurements/1
  def show
  end

  # GET /measurements/new
  def new
    @data_list_id = DataList.find(params[:data_list_id]).id rescue nil
    @measurement = Measurement.new
  end

  # GET /measurements/1/edit
  def edit
  end

  # POST /measurements
  def create
    data_list = DataList.find(params[:data_list_id]) rescue nil
    ## universe setting?
    @measurement = Measurement.new(measurement_params)

    if @measurement.save
      if data_list
        data_list.add_measurement(@measurement)
        redirect_to edit_data_list_path(data_list)
      else
        redirect_to @measurement, notice: 'Measurement was successfully created.'
      end
    else
      render :new
    end
  end
  
  def duplicate
    original_measurement = Measurement.find params[:id]
    new_measurement = original_measurement.dup
    new_measurement.prefix = original_measurement.prefix + ' (copy)'
    new_measurement.series = original_measurement.series
    new_measurement.save
    redirect_to edit_measurement_url(new_measurement.id)
  end

  # PATCH/PUT /measurements/1
  def update
    if @measurement.update(measurement_params)
      redirect_to @measurement, notice: 'Measurement was successfully updated.'
    else
      render :edit
    end
  end

  def add_series
    series = Series.find(params[:series_id])
    if @measurement.series.include? series
      redirect_to edit_measurement_url(@measurement.id), notice: 'This series is already included!'
      return
    end
    @measurement.series << series
    respond_to do |format|
      format.html { redirect_to edit_measurement_url(@measurement.id) }
      format.js {}
    end
  end

  def remove_series
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    series = Series.find(params[:series_id])
    @measurement.series.destroy(series)
  end

  def propagate
    fields = params[:field_boxes]
    series = params[:series_boxes]
    unless fields && series
      redirect_to({action: :show, id: @measurement}, notice: 'Please select at least one field and one series')
      return
    end
    allowed_fields = ALL_PROPAGATE_FIELDS.map{|f| f[1].to_s }
    fields_to_update = fields.keys.select{|f| allowed_fields.include?(f) }
    if fields_to_update.empty?
      redirect_to({action: :show, id: @measurement}, notice: 'No fields to update were found.')
      return
    end
    new_vals_hash = fields_to_update.map{|f| [translate(f), @measurement.read_attribute(f)] }.to_h
    series.keys.each {|s| Series.find_by(name: s).update_attributes new_vals_hash }
    redirect_to(@measurement, notice: 'Field(s) '+fields_to_update.join(', ')+' propagated successfully.')
  end

  private
    def translate(name)
      # Translate column names from Measurement table form to Series table form
      trans_hash = {'data_portal_name' => 'dataPortalName'}
      trans_hash[name] || name
    end

    # Use callbacks to share common setup or constraints between actions.
    def set_measurement
      @measurement = Measurement.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def measurement_params
      params.require(:measurement).permit(:universe, :prefix, :data_portal_name, :table_prefix, :table_postfix,
                                          :unit_id, :percent, :real, :notes,
                                          :restricted, :unrestricted, :series_id, :decimals,
                                          :seasonally_adjusted, :seasonal_adjustment, :frequency_transform,
                                          :source_detail_id, :source_id, :source_link,
                                          :field_boxes, :series_boxes)
    end
end
