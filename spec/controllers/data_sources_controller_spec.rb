require 'spec_helper'

describe DataSourcesController do

  unit = Unit.get_or_new(universe: 'TEST UHERO', short_label: 'FAKE', long_label: 'Fake Unit')
  geography = Geography.get_or_new(handle: 'HI', display_name: 'State of Hawaii', display_name_short: 'Hawaii')
  xseries = XSeries.get_or_new(
  percent: true,  # or false, based on your model requirements
  seasonal_adjustment: 'seasonally_adjusted',  # You can adjust the value based on the enum or requirement
  frequency_transform: 'some_value',  # Replace with actual valid value
  restricted: false  # or true, depending on your model requirements
)
  source = Source.get_or_new(name: 'first eval', priority: 100)
  source_detail = SourceDetail.get_or_new(description: 'Source Detail for FAKE@PLACE.A')
  datalist = DataList.get_or_new(name: 'Example DataList')

  series = Series.get_or_new(
    universe: 'TEST UHERO',
    name: 'FAKE@PLACE.A',
    unit: unit,
    geography: geography,
    xseries: xseries,
    source: source,
    source_detail: source_detail
  )

  series.data_lists << datalist
  # data_source = DataSource.new
  # data_source.series_id = series.id
  # data_source.eval = 'first eval'
  # data_source.priority = 100
  # data_source.save

  before(:each) do
    @request.env['devise.mapping'] = Devise.mappings[:user]
    user = FactoryBot.create(:user)
    sign_in user
  end

  describe "update 'data_sources'" do
    before do
      allow(DataSource).to receive(:find).and_return(data_source)
      allow(data_source).to receive(:series).and_return(series)
      allow(DataSourceAction).to receive(:create)
    end

    it "creates a data_source_action" do
      new_eval = 'update eval'
      new_priority = 123
      put :update, params: { id: data_source, :data_source => { :series_id => series.id, :eval => new_eval, :priority => new_priority} }
      expect(DataSourceAction).to have_received(:create)
    end
  end

  describe "create 'data_sources'" do
    before do
      allow(Series).to receive(:eval) { data_source.update!(last_run: Time.now) }
      allow(Series).to receive(:find_by) { series }
      allow(data_source).to receive(:series).and_return(series)
      allow(series).to receive(:data_sources_by_last_run).and_return([data_source])
      allow(DataSourceAction).to receive(:create)
    end

    it "creates a data_source_action" do
      new_eval = 'new eval'
      new_priority = 123
      post :create, params: { :data_source => { :series_id => series.id, :eval => new_eval, :priority => new_priority} }
      expect(DataSourceAction).to have_received(:create)
    end
  end

  describe "delete 'data_sources'" do
    before do
      allow(DataSource).to receive(:find).and_return(data_source)
      allow(data_source).to receive(:series).and_return(Series.first)
      allow(data_source).to receive(:delete).and_return(true)
      allow(DataSourceAction).to receive(:create)
    end

    it "creates a data_source_action" do
      get :delete, params: { id: data_source }
      expect(DataSourceAction).to have_received(:create)
    end
  end
end
