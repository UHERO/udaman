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
    user = FactoryGirl.create(:user)
    sign_in user
  end

  describe "POST 'data_sources'" do

    it "should create a data_source_action on update" do
      new_eval = 'new eval'
      new_priority = 123
      put :update, id: data_source, :data_source => { :series_id => series.id, :eval => new_eval, :priority => new_priority}
      dsa = DataSourceAction.last
      expect(dsa[:action]).to be == 'UPDATE'
      expect(dsa[:eval]).to be == new_eval
      expect(dsa[:priority]).to be == new_priority
    end
  end

  describe "POST 'data_sources'" do

    it "should create a data_source_action on create" do
      new_eval = 'new eval'
      new_priority = 123
      puts series
      puts series.id
      puts series.name
      allow(Series).to receive(:eval) { data_source.update!(last_run: Time.now) }
      allow(Series).to receive(:find_by) { series }

      post :create, { :data_source => { :series_id => series.id, :eval => new_eval, :priority => new_priority} }
      dsa = DataSourceAction.last
      expect(dsa[:action]).to be == 'CREATE'
      expect(dsa[:eval]).to be == new_eval
      expect(dsa[:priority]).to be == new_priority
    end
  end
end
