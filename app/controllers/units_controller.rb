class UnitsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_unit, only: [:show, :edit, :update, :destroy]

  def index
    @universe = params[:u].upcase rescue 'UHERO'
    @units = Unit.where(universe: @universe).order(:short_label, :long_label).all
  end

  def show
  end

  def new
    @unit = Unit.new
    @universe = params[:u].upcase rescue params[:universe].upcase rescue 'UHERO'
  end

  def edit
  end

  # POST /units
  def create
    # Don't allow empty or whitespace strings in the db
    if unit_params[:short_label].blank? || unit_params[:long_label].blank?
      redirect_to({ :action => :new }, notice: 'Blank entries not allowed')
      return
    end
    unit_params[:short_label].strip!
    unit_params[:long_label].strip!
    @unit = Unit.new(unit_params)
    error = 'Unknown error'

    begin
      saved = @unit.save
    rescue => e
      if e.message =~ /duplicate entry/i
        error = 'Unit not saved: Duplicate entry'
      else
        error = "Unit not saved: #{e.message}"
      end
    end

    if saved
      @unit.reload
      redirect_to units_path(u: @unit.universe), notice: 'Unit was successfully created.'
    else
      redirect_to({ :action => :new }, notice: error)
    end
  end

  # PATCH/PUT /units/1
  def update
    # Don't allow empty or whitespace strings in the db
      if unit_params[:short_label].blank? || unit_params[:long_label].blank?
      redirect_to({ :action => :edit }, notice: 'Blank entries not allowed')
      return
    end
    unit_params[:short_label].strip!
    unit_params[:long_label].strip!

    error = 'Unknown error'
    properties = unit_params.to_h
    properties.delete(:universe)  ## don't allow update of universe
    begin
      updated = @unit.update(properties)
    rescue => e
      if e.message =~ /duplicate entry/i
        error = 'Unit not saved: Duplicate entry'
      else
        error = "Unit not saved: #{e.message}"
      end
    end

    if updated
      redirect_to units_path(u: @unit.universe), notice: 'Unit was successfully updated.'
    else
      render({:action => :edit}, notice: error)
    end
  end

private
    # Use callbacks to share common setup or constraints between actions.
    def set_unit
      @unit = Unit.find params[:id]
    end

    # Only allow a trusted parameter "white list" through.
    def unit_params
      params.require(:unit).permit(:short_label, :long_label, :universe)
    end
end
