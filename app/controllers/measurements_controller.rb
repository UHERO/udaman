class MeasurementsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_measurement, only: [:show, :edit, :update, :add_series, :remove_series,
                                         :propagate, :propagate_save, :destroy]

  ALL_PROPAGATE_FIELDS = %w{data_portal_name units_label units_label_short
                            source_id source_detail_id source_link
                            seasonally_adjusted percent real restricted
                            frequency_transform notes}

  # GET /measurements
  def index
    if params[:unrestricted]
      @measurements = Measurement.includes(:series).where(:series => {:restricted => false}).order(:prefix)
      return
    end
    @measurements = Measurement.all
  end

  # GET /measurements/1
  def show
  end

  # GET /measurements/new
  def new
    @measurement = Measurement.new
  end

  # GET /measurements/1/edit
  def edit
  end

  # POST /measurements
  def create
    @measurement = Measurement.new(measurement_params)

    if @measurement.save
      redirect_to @measurement, notice: 'Measurement was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /measurements/1
  def update
    if @measurement.update(measurement_params)
      redirect_to @measurement, notice: 'Measurement was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /measurements/1
  def destroy
    @measurement.destroy
    redirect_to measurements_url, notice: 'Measurement was successfully destroyed.'
  end

  def add_series
    series = Series.find(params[:series_id])
    if series.measurement_id == @measurement.id
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
    if series.measurement_id == @measurement.id
      series.update! measurement_id: nil
    end
  end

  def propagate
    @all_fields = ALL_PROPAGATE_FIELDS
  end

  def propagate_save
    fields = params[:the_fields]
    series = params[:the_series]
    new_vals_hash = fields.select{|f| ALL_PROPAGATE_FIELDS.include?(f) }.map{|f| [translate(f), @measurement.read_attribute(f)] }.to_h
    series.each {|s| Series.find_by(name: s).update_attributes new_vals_hash }

    respond_to do |format|
      format.html { redirect_to(@measurement, notice: 'Fields propagated successfully.') }
    end
  end

  private
    def translate(name)
      trans_hash = {'data_portal_name' => 'dataPortalName',
                    'units_label' => 'unitsLabel',
                    'units_label_short' => 'unitsLabelShort',
                    'notes' => 'investigation_notes'}
      trans_hash[name] || name
    end

    # Use callbacks to share common setup or constraints between actions.
    def set_measurement
      @measurement = Measurement.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def measurement_params
      params.require(:measurement).permit(:prefix, :data_portal_name, :units_label,
                                          :units_label_short, :percent, :real, :notes,
                                          :restricted, :unrestricted, :series_id,
                                          :seasonally_adjusted, :frequency_transform,
                                          :source_detail_id, :source_id, :source_link)
    end
end
