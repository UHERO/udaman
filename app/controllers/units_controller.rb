class UnitsController < ApplicationController
  before_action :set_unit, only: [:show, :edit, :update, :destroy]

  # GET /units
  def index
    @units = Unit.all.order(:short_label, :long_label)
  end

  # GET /units/1
  def show
  end

  # GET /units/new
  def new
    @unit = Unit.new
  end

  # GET /units/1/edit
  def edit
  end

  # POST /units
  def create
    # Don't allow empty or whitespace strings in the db
    if params[:unit][:short_label].blank?
      params[:unit][:short_label] = nil
    end
    params[:unit][:long_label] = nil if params[:unit][:long_label].blank?

    @unit = Unit.new(unit_params)
    error = 'Generic error'

    begin
      saved = @unit.save
    rescue Exception => e
      if e.message =~ /duplicate entry/i
        error = 'Unit not saved: Duplicate entry'
      else
        error = "Unit not saved: #{e.message}"
      end
    end

    if saved
      redirect_to @unit, notice: 'Unit was successfully created.'
    else
     redirect_to({:action => :new}, notice: error)
    end
  end

  # PATCH/PUT /units/1
  def update
    # Don't allow empty  or whitespace strings in the db
    params[:unit][:short_label] = nil if params[:unit][:short_label].blank?
    params[:unit][:long_label] = nil if params[:unit][:long_label].blank?
    error = 'Generic error'

    begin
      updated = @unit.update(unit_params)
    rescue Exception => e
      if e.message =~ /duplicate entry/i
        error = 'Unit not saved: Duplicate entry'
      else
        error = "Unit not saved: #{e.message}"
      end
    end

    if updated
      redirect_to @unit, notice: 'Unit was successfully updated.'
    else
      render({:action => :edit}, notice: error)
    end
  end

  # DELETE /units/1
  def destroy
    @unit.destroy
    redirect_to units_url, notice: 'Unit was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_unit
      @unit = Unit.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def unit_params
      params.require(:unit).permit(:short_label, :long_label)
    end
end
