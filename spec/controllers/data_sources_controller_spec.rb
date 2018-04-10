require 'spec_helper'

describe DataSourcesController do

  series = Series.create(universe: 'UHERO', name: 'FAKE@PLACE.A', units: 1)
  data_source = DataSource.new
  data_source.series_id = series.id
  data_source.eval = 'first eval'
  data_source.priority = 100
  data_source.save

  before(:each) do
    @request.env['devise.mapping'] = Devise.mappings[:user]
    user = FactoryBot.create(:user)
    sign_in user
  end

  describe "update 'data_sources'" do
    before do
      allow(DataSource).to receive(:find_by).and_return(data_source)
      allow(data_source).to receive(:series).and_return(series)
      allow(DataSourceAction).to receive(:create)
    end

    it "creates a data_source_action" do
      new_eval = 'update eval'
      new_priority = 123
      put :update, id: data_source, :data_source => { :series_id => series.id, :eval => new_eval, :priority => new_priority}
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
      post :create, { :data_source => { :series_id => series.id, :eval => new_eval, :priority => new_priority} }
      expect(DataSourceAction).to have_received(:create)
    end
  end

  describe "delete 'data_sources'" do
    before do
      allow(DataSource).to receive(:find_by).and_return(data_source)
      allow(data_source).to receive(:series).and_return(Series.first)
      allow(data_source).to receive(:delete).and_return(true)
      allow(DataSourceAction).to receive(:create)
    end

    it "creates a data_source_action" do
      get :delete, id: data_source
      expect(DataSourceAction).to have_received(:create)
    end
  end
end
